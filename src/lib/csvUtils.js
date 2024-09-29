import { Parser } from 'json2csv';

export function generateCSV(data, fields) {
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
}
