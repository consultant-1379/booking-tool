SearchService.$inject = ['$resource'];
export default function SearchService($resource) {
  var Search = $resource('/api/search:searchParameters', {
    searchParameters: '@searchParameters'
  });
  return Search;
}
