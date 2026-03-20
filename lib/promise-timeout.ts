type WithTimeoutOptions = {
  timeoutMs: number
  errorMessage: string
}

export async function withTimeout<T>(promise: Promise<T>, options: WithTimeoutOptions): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(options.errorMessage))
        }, options.timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
