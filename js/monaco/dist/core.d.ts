import type { CustomTSWebWorkerFactory } from './types.ts';
type WorkerFactory = ({ name, append }?: {
    name?: string;
    append?: string;
}) => Worker;
type InitMonacoOptions = {
    customTSWorkerPath?: string;
    customTSWorkerFactory?: CustomTSWebWorkerFactory;
    getWorker?: (workerId: string, label: string) => Promise<Worker> | Worker;
    workers?: {
        css?: WorkerFactory;
        html?: WorkerFactory;
        json?: WorkerFactory;
        typescript?: WorkerFactory;
        editor?: WorkerFactory;
    };
};
export { loadCss } from './loadCss.ts';
export declare function initMonaco(options?: InitMonacoOptions): void;
