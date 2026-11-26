import { Prisma } from '../generated/prisma/client';

const MAX_TRANSACTION_ATTEMPTS = 3;

/** Nhận diện xung đột đã rollback do Prisma hoặc deadlock từ MySQL. */
function isWriteConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { kind?: unknown; originalCode?: unknown } } | undefined;
  return (
    error.code === 'P2010' &&
    adapterError?.cause?.kind === 'TransactionWriteConflict' &&
    adapterError.cause.originalCode === '1213'
  );
}

/** Thử lại toàn bộ transaction khi xung đột ghi có thể phục hồi. */
export async function retryWriteTransaction<T>(
  run: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= MAX_TRANSACTION_ATTEMPTS || !isWriteConflict(error))
        throw error;
    }
  }
}
