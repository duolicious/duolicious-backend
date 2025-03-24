import { jest } from '@jest/globals';

jest.useFakeTimers();
jest.mock('../../websocket-layer', () => ({
  send: jest.fn(),
}));

describe('Batching Mechanism and Reference Counting', () => {
  let subscribe;
  let send;

  beforeEach(() => {
    // Reset modules and import a fresh instance
    jest.resetModules();
    const online = require('./online');
    subscribe = online.subscribe;
    send = require('../../websocket-layer').send;
    jest.clearAllTimers();
  });

  test('should send subscribe event after 200ms for a single subscribe', () => {
    subscribe('person1');
    // Before the batch window expires, no event should be sent.
    expect(send).not.toHaveBeenCalled();

    // Fast-forward 200ms to trigger the flush.
    jest.advanceTimersByTime(200);

    // We expect a single subscribe event.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      data: { duo_subscribe_online: { '@uuid': 'person1' } },
    });
  });

  test('should not send any event if subscribe and unsubscribe cancel out', () => {
    const unsubscribe = subscribe('person1');
    unsubscribe();

    // Flush the batch.
    jest.advanceTimersByTime(200);

    // Since subscribe and unsubscribe cancel each other, no event should be sent.
    expect(send).not.toHaveBeenCalled();
  });

  test('should send subscribe event only once even with multiple subscribes in a batch', () => {
    subscribe('person1');
    subscribe('person1');

    jest.advanceTimersByTime(200);

    // Even though subscribe was called twice, only one subscribe event is sent.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      data: { duo_subscribe_online: { '@uuid': 'person1' } },
    });
  });

  test('should send unsubscribe event when unsubscribing crosses from positive to 0', () => {
    const unsubscribe = subscribe('person1');

    // Trigger subscribe event.
    jest.advanceTimersByTime(200);
    expect(send).toHaveBeenCalledTimes(1);

    unsubscribe();
    jest.advanceTimersByTime(200);

    // Now an unsubscribe event should be sent.
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual({
      data: { duo_unsubscribe_online: { '@uuid': 'person1' } },
    });
  });

  test('should combine multiple subscribe/unsubscribe events correctly in one batch', () => {
    const unsubscribe1 = subscribe('person1');
    const unsubscribe2 = subscribe('person1');
    unsubscribe1();
    unsubscribe2();

    jest.advanceTimersByTime(200);

    // All actions cancel out so no event should be sent.
    expect(send).not.toHaveBeenCalled();
  });
});
