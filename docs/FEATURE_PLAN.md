# JetQueue - Feature plan

## Phase one

### Job batching
1. A `addBatch` method that internally splits an array into chunks and processes them with a single `bulk` handler, or uses a generator.
### Better error handling + DLQ
1. Add a `onFailedPermanently` hook or a `.dlq.add(job)` method. Store the failed job's payload, stack trace, and context in a separate storage table `(failed_jobs) `so an admin can manually retry or inspect it later.
### Result storage
1. Store the result in the Storage table and use the `_resolve`/`_reject` promises
2. Expose a public `waitForResult(jobId, timeout)` that listens to the `job:completed/job:failed` events.
