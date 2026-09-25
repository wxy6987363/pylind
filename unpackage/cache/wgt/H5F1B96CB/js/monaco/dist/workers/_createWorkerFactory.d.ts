export type WorkerFactory = ({ name, append }: {
    name: string;
    append?: string;
}) => Worker;
export declare function createWorkerFactory(workerCode: string): WorkerFactory;
