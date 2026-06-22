class PromiseQueue {
  private queue: (() => Promise<void>)[] = [];
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

// Answer writes (and undos) need to finish in order. If we send two http
// requests at roughly the same time, the server will see them in an arbitrary
// order. So if the user undoes then re-answers a question in short succession,
// their re-answer might be deleted. So we use a queue to make sure that doesn't
// happen.
const quizQueue = new PromiseQueue();

// Fetching the next batch of cards is kept on its own queue, separate from
// quizQueue. Otherwise an answer write that's stuck retrying (e.g. while
// offline) would block the queue and prevent us from ever topping up the stack,
// so the user would never see the skeleton cards as they swipe to the end.
const cardQueue = new PromiseQueue();

const aboutQueue = new PromiseQueue();

const nameQueue = new PromiseQueue();

const onboardingQueue = new PromiseQueue();

// Search queries need to be issued in sequence because each query updates the
// club to search by on the server (and the list of matches too). This could
// cause one query in a pair of queries to overwrite the other's results.
const searchQueue = new PromiseQueue();

const photoQueue = new PromiseQueue();

export {
  aboutQueue,
  cardQueue,
  nameQueue,
  onboardingQueue,
  photoQueue,
  quizQueue,
  searchQueue,
};
