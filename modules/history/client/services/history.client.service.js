exports.getService = function (objType) {
  getHistoryService.$inject = ['$resource'];
  async function getHistoryService($resource) {
    var Log = await $resource(`/api/logs/${objType}/:objId`, {
      objId: '@associated_id'
    }, {
      aggregate: {
        method: 'POST',
        isArray: true,
        url: `/api/logs/${objType}`
      }
    });
    return Log;
  }
  return getHistoryService;
};
