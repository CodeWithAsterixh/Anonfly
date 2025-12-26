/**
 * Removes a specific key from each object in an array.
 *
 * @param {Array<Record<string, any>>} array - The array of objects.
 * @param {string} objectKey - The key to remove from each object.
 * @returns {Array<Record<string, any>>} A new array with the key removed from each object.
 */
export default function removeFromObjectArray(array: any[], objectKey: string | number) {
  return array.map((i) => {
    const copy = { ...i };
    delete copy[objectKey];
    return copy;
  });
}
