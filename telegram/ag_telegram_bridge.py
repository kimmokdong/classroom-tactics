import os
import sys
import asyncio
import threading
import time
import re
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

try:
    import winpty
except ImportError:
    print("❌ pywinpty가 설치되지 않았습니다.")
    print("   pip install pywinpty")
    sys.exit(1)

# --- [사용자 설정 영역] ---
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8978626029:AAHD-q2xFtkYtozUIaPpwW9Aq-u1WFPdG1o")
WATCH_DIR = r"C:\Users\hyunseung\Desktop\classroom-tactics\telegram"
AG_PATH = r"C:\Users\hyunseung\AppData\Local\agy\bin\agy.exe"

# 60초마다 "작업 중" 알림 전송
HEARTBEAT_INTERVAL = 60

# 전역 변수
app_instance = None
target_chat_id = None
loop = None
pty_process = None
pty_lock = asyncio.Lock()
file_watch_active = False


# --- [ANSI 제거] ---
ANSI_ESCAPE = re.compile(
    r'\x1b(?:\[[0-9;?=><!]*[a-zA-Z~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[^\[\]()])' 
)

def strip_ansi(text: str) -> str:
    text = ANSI_ESCAPE.sub('', text)
    text = re.sub(r'\[\?25[hl]', '', text)
    text = re.sub(r'\r', '', text)
    return text


# --- [agy 응답 정제] ---
SPINNER_CHARS = '⣷⣯⣟⡿⢿⣻⣽⣾'

def clean_agy_output(raw: str, prompt: str) -> str:
    """ANSI 제거 + agy UI 잡음 제거 후 실제 답변만 추출"""
    text = strip_ansi(raw)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if re.fullmatch(r'─{3,}', s):
            continue
        if re.match(r'(?:esc to cancel|\? for shortcuts)', s):
            continue
        if re.match(r'[└●▸]\s', s):
            continue
        s = re.sub(rf'[{re.escape(SPINNER_CHARS)}]\s*(?:Gener\w*\.{{0,3}})?', '', s).strip()
        if not s:
            continue
        if re.fullmatch(r'Generating\.{0,3}', s):
            continue
        cleaned.append(s)

    result = '\n'.join(cleaned).strip()

    # 에코된 입력 제거
    if prompt and result.startswith(prompt):
        result = result[len(prompt):].lstrip()

    # 앞뒤 프롬프트 기호 제거
    result = re.sub(r'^[>❯]+\s*', '', result).strip()
    result = re.sub(r'\n[>❯]+\s*$', '', result).strip()

    return result


# --- [폴더 감시] ---
class ArtifactHandler(FileSystemEventHandler):
    def on_created(self, event):
        global file_watch_active
        if event.is_directory:
            return
        if not file_watch_active:
            return
        name = os.path.basename(event.src_path)
        if name.endswith('.py') or name.startswith('_'):
            return
        print(f"📦 파일 감지: {name}")
        if target_chat_id and loop:
            asyncio.run_coroutine_threadsafe(send_file_to_telegram(event.src_path, name), loop)


async def send_file_to_telegram(file_path, file_name):
    try:
        await asyncio.sleep(2)
        with open(file_path, 'rb') as f:
            await app_instance.bot.send_document(
                chat_id=target_chat_id,
                document=f,
                caption=f"🔔 [{file_name}] 완료!"
            )
    except Exception as e:
        print(f"❌ 파일 전송 실패: {e}")


# --- [PTY 프로세스 시작] ---
def start_pty():
    global pty_process
    print("🛸 agy PTY 세션 시작 중...")
    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        pty_process = winpty.PtyProcess.spawn(AG_PATH, cwd=WATCH_DIR, env=env)
        print(f"⏳ agy 초기화 대기 (3초)...")
        time.sleep(3)
        # 초기 화면 버퍼 비우기
        try:
            pty_process.read(8192)
        except Exception:
            pass
        print("✅ agy PTY 준비 완료!")
    except Exception as e:
        print(f"❌ PTY 시작 실패: {e}")
        pty_process = None


# --- [PTY 응답 수집 (별도 스레드)] ---
def collect_response(prompt: str, result_holder: list, heartbeat_fn):
    """
    agy가 응답을 완료하고 '>' 프롬프트로 돌아올 때까지 무한 대기.
    타임아웃 없음 - 아무리 오래 걸려도 끝까지 기다림.
    """
    collected = ""
    clean_collected = ""
    last_heartbeat = time.time()

    while True:
        try:
            chunk = pty_process.read(4096)
        except EOFError:
            break
        except Exception:
            time.sleep(0.05)
            continue

        if not chunk:
            time.sleep(0.05)
            continue

        collected += chunk
        clean_chunk = strip_ansi(chunk)
        clean_collected += clean_chunk
        print(clean_chunk, end='', flush=True)

        # heartbeat 전송
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            heartbeat_fn(0)
            last_heartbeat = now

        # 응답 완료 감지
        # 충분한 텍스트가 쌓인 후, 마지막 비어있지 않은 줄이 '>' 또는 '❯'인지 확인
        if len(clean_collected.strip()) > len(prompt) + 5:
            # 마지막으로 출력된 비어있지 않은 줄 추출
            last_nonempty = ''
            for ln in reversed(clean_collected.split('\n')):
                if ln.strip():
                    last_nonempty = ln.strip()
                    break
            if last_nonempty in ('>', '❯', '> ', '❯ '):
                break
            # 또는 버퍼 끝부분이 '\n> ' 패턴
            tail = clean_collected[-20:]
            if re.search(r'\n\s*[>\u276f]\s*$', tail):
                break

    result_holder[0] = collected


# --- [핵심: agy에 메시지 전송 및 응답 수집] ---
async def talk_to_agy(prompt: str, update: Update):
    global pty_process

    # PTY 재시작 필요 시
    if pty_process is None or not pty_process.isalive():
        await asyncio.get_event_loop().run_in_executor(None, start_pty)
        if pty_process is None or not pty_process.isalive():
            await update.message.reply_text("❌ agy 프로세스를 시작할 수 없습니다.")
            return

    async with pty_lock:
        print(f"\n💬 [텔레그램 → agy]: {prompt}")
        pty_process.write(prompt + "\r\n")

        start_time = time.time()
        result_holder = [None, start_time]  # [응답, 시작시간]

        # heartbeat 함수 (스레드에서 asyncio로 메시지 전송)
        def send_heartbeat(elapsed_ignored):
            elapsed = int(time.time() - start_time)
            m, s = divmod(elapsed, 60)
            time_str = f"{m}분 {s}초" if m > 0 else f"{s}초"
            if target_chat_id and loop:
                asyncio.run_coroutine_threadsafe(
                    app_instance.bot.send_message(
                        chat_id=target_chat_id,
                        text=f"⏳ agy 작업 중... ({time_str} 경과)\n완료되면 자동으로 알려드립니다."
                    ),
                    loop
                )

        # 별도 스레드에서 응답 수집 (블로킹 read를 이벤트 루프 밖에서)
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: collect_response(prompt, result_holder, send_heartbeat)
        )

        raw = result_holder[0] or ""
        reply = clean_agy_output(raw, prompt)

        if reply:
            print(f"\n=== [응답 완료] ===\n{reply}\n==================")
            if len(reply) > 4000:
                for chunk in [reply[i:i+4000] for i in range(0, len(reply), 4000)]:
                    await update.message.reply_text(chunk)
            else:
                await update.message.reply_text(reply)
        else:
            await update.message.reply_text("⚠️ 응답을 수집하지 못했습니다. 터미널을 확인해보세요.")


# --- [텔레그램 핸들러] ---
async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global target_chat_id
    target_chat_id = update.effective_chat.id
    await update.message.reply_text(
        "🚀 안티그래비티 텔레그램 브릿지 가동!\n\n"
        "💬 일반 메시지: agy와 대화\n"
        "📁 /run [지시]: 파일 생성 작업 (결과 파일 자동 전송)"
    )


async def run_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global target_chat_id, file_watch_active
    target_chat_id = update.effective_chat.id

    prompt = ' '.join(context.args) if context.args else None
    if not prompt:
        await update.message.reply_text("사용법: /run [작업 지시]\n예: /run 시뮬레이션 돌리고 결과 분석해줘")
        return

    # 결과를 HTML 아티팩트로 저장하도록 지시 자동 추가
    full_prompt = (
        prompt +
        f"\n\n[중요] 작업이 완료되면 결과를 분석하여 시각적으로 잘 정리된 HTML 아티팩트를 작성하고 "
        f"{WATCH_DIR}\\시뮬레이션결과.html 파일로 저장해줘."
    )

    await update.message.reply_text(f"📁 작업 시작!\n지시: {prompt}\n\n⏳ 완료되면 파일로 전송됩니다.")

    file_watch_active = True
    try:
        await talk_to_agy(full_prompt, update)
    finally:
        await asyncio.sleep(10)
        file_watch_active = False


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global target_chat_id
    target_chat_id = update.effective_chat.id
    await update.message.reply_text("🤖 처리 중...")
    await talk_to_agy(update.message.text, update)


# --- [메인] ---
async def async_main():
    global app_instance, loop

    if TOKEN == "여기에_토큰을_넣으세요":
        print("❌ 텔레그램 봇 토큰을 설정해주세요!")
        sys.exit(1)

    if not os.path.exists(WATCH_DIR):
        os.makedirs(WATCH_DIR)

    observer = Observer()
    observer.schedule(ArtifactHandler(), path=WATCH_DIR, recursive=False)
    observer.start()

    loop = asyncio.get_running_loop()

    # PTY 시작
    await loop.run_in_executor(None, start_pty)

    application = Application.builder().token(TOKEN).build()
    app_instance = application

    application.add_handler(CommandHandler("start", start_cmd))
    application.add_handler(CommandHandler("run", run_cmd))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    await application.initialize()
    await application.start()
    await application.updater.start_polling()

    print("🚀 가동 완료!")
    print(f"   📂 감시 폴더: {WATCH_DIR}")
    print(f"   ⏱️  heartbeat: {HEARTBEAT_INTERVAL}초마다")

    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        observer.stop()
        observer.join()
        if pty_process and pty_process.isalive():
            pty_process.terminate()
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(async_main())
    except (KeyboardInterrupt, SystemExit):
        print("\n🛑 종료.")
