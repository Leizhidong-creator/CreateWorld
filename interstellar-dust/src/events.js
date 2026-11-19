/** Small synchronous event bus. All subscriptions return an unsubscribe function. */
export class Events {
  #listeners = new Map();
  on(type, callback) {
    const set = this.#listeners.get(type) || new Set();
    set.add(callback); this.#listeners.set(type, set);
    return () => set.delete(callback);
  }
  emit(type, value) { for (const fn of this.#listeners.get(type) || []) fn(value); }
  clear() { this.#listeners.clear(); }
}
