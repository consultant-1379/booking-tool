config.$inject = ['NotificationProvider'];
export default function config(NotificationProvider) {
  NotificationProvider.setOptions({
    delay: 20000,
    startTop: 20,
    startRight: 10,
    verticalSpacing: 20,
    horizontalSpacing: 20,
    positionX: 'right',
    positionY: 'bottom',
    replaceMessage: true
  });
}
