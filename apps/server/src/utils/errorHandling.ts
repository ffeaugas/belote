export const assert = (condition: boolean, message: string) => {
    if (!condition) {
        console.error("Assertion failed: ", message);
        throw new Error(message)
    }
}