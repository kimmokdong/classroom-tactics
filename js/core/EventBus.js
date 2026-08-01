export class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        if (!this.listeners[event].includes(callback)) {
            this.listeners[event].push(callback);
        }
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, ...args) {
        if (!this.listeners[event]) return;
        [...this.listeners[event]].forEach(cb => cb(...args));
    }
}

export const eventBus = new EventBus();
