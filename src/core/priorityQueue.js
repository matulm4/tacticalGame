/**
 * Min-heap: pop() returns the item with the smallest priority. Items with the
 * same priority come out in the order they were pushed, so searches that use
 * it (path finding, planning) are deterministic.
 */
export class PriorityQueue {
  #heap = [];
  #pushed = 0;

  get size() {
    return this.#heap.length;
  }

  push(item, priority) {
    const heap = this.#heap;
    heap.push({ item, priority, order: this.#pushed++ });

    let child = heap.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (!this.#before(heap[child], heap[parent])) break;
      [heap[child], heap[parent]] = [heap[parent], heap[child]];
      child = parent;
    }
  }

  /** Remove and return the item with the smallest priority (undefined when empty). */
  pop() {
    const heap = this.#heap;
    if (heap.length === 0) return undefined;

    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < heap.length && this.#before(heap[left], heap[smallest])) smallest = left;
        if (right < heap.length && this.#before(heap[right], heap[smallest])) smallest = right;
        if (smallest === parent) break;
        [heap[parent], heap[smallest]] = [heap[smallest], heap[parent]];
        parent = smallest;
      }
    }
    return top.item;
  }

  #before(a, b) {
    return a.priority < b.priority || (a.priority === b.priority && a.order < b.order);
  }
}
