export default function stopPropagation() {
  return {
    restrict: 'A',
    link: function (scope, elem) {
      elem.on('click', function (event) {
        event.stopPropagation();
      });
    }
  };
}
