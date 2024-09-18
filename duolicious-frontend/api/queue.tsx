class PromiseQueue {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  addTask<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Enqueue the task
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) {
        continue;
      }

      try {
        await task();
      } catch (e) {
        console.warn(e);
      }
    }

    this.isProcessing = false;
  }
}

// Operations on the cards need to finish in order. If we send two http request
// at roughly the same time, the server will see them in an arbitrary order. So
// if the user undoes then re-answers a question in short succession, their
// re-answer might be deleted. So we use a queue to make sure that doesn't
// happen.
const quizQueue = new PromiseQueue();

const aboutQueue = new PromiseQueue();

// Search queries need to be issued in sequence because each query updates the
// club to search by on the server (and the list of matches too). This could
// cause one query in a pair of queries to overwrite the other's results.
const searchQueue = new PromiseQueue();

export {
  aboutQueue,
  quizQueue,
  searchQueue,
};
