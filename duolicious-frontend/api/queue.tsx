class PromiseQueue {
  private taskQueue: Array<() => Promise<any>>;

  constructor() {
    this.taskQueue = [];
  }

  async addTask(task: () => Promise<any>): Promise<void> {
    // Add task to the queue
    this.taskQueue.push(task);

    // If there's more than one task in the queue, the previous tasks are still
    // running So we just return and let them finish
    if (this.taskQueue.length > 1) return;

    // Process all tasks
    while (this.taskQueue.length > 0) {
      const currentTask = this.taskQueue[0];
      await currentTask();
      this.taskQueue.shift();
    }
  }
}

// Operations on the cards need to finish in order. If we send two http request
// at roughly the same time, the server will see them in an arbitrary order. So
// if the user undoes then re-answers a question in short succession, their
// re-answer might be deleted. So we use a queue to make sure that doesn't
// happen.
const quizQueue = new PromiseQueue();

export {
  quizQueue,
};
