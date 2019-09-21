// Parse through an ApiResource query
// and generate some SQL from it

function lookFor(search, message) {
  if (!search) {
    throw new Error(message)
  }
}

/**
 * @description Parse ApiRequest query into standard SQL
 */
module.exports = function parseQuery(queryObj) {
  // Look for the initial table
  let tableName = queryObj.table
  let
  let
}