# JetQueue - Feature plan

> [!NOTE]
> The phase one of the new features is out, you can use it in you projects. And we are planing to start phase 2 ASAP

## Phase one

### Storage factory + PostgreSQL/Redis adapters

1. Implement an storage factory (Postgres/Redis/MongoDB) to let the devs choose their database 
2. And also move the SQLite for the development env

### MinHeap implementation

1. Add `MinHeap` for better performance on large scale sorting for the queues

### Config file system

1. Add file based configuration (jetqueue.config.ts) for better dev experience;

## Phase two

### Job batching
1. A `addBatch` method that internally splits an array into chunks and processes them with a single `bulk` handler, or uses a generator.
### Better error handling + DLQ
1. Add a `onFailedPermanently` hook or a `.dlq.add(job)` method. Store the failed job's payload, stack trace, and context in a separate storage table `(failed_jobs) `so an admin can manually retry or inspect it later.
### Result storage
1. Store the result in the Storage table and use the `_resolve`/`_reject` promises
2. Expose a public `waitForResult(jobId, timeout)` that listens to the `job:completed/job:failed` events.
## Phase 3

### Job dependencies, DAQ (semi workflow engine)
1. When a job completes, check if its dependents are ready to be unlocked (i.e., all parents are completed). This requires tracking child dependencies in storage.
### Rate limiting (for external APIs)
### Cron scheduling
### Advanced monitoring (enhance the web dashboard)
