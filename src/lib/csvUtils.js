import { Parser } from 'json2csv';

/**
 * Generates a CSV string from an array of objects.
 * @param {Record<string, any>[]} data - An array of objects to convert to CSV.
 * @param {string[]} fields - An array of strings specifying the fields (columns) for the CSV.
 * @returns {string} The generated CSV string.
 * @throws {Error} If there's an error during CSV parsing.
 */
export function generateCSV(data, fields) {
  try {
    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  } catch (err) {
    console.error('Error generating CSV:', err);
    throw err; // Re-throw the error to be handled by the caller
  }
}
