var commonController = require('../../../core/client/controllers/common-list.client.controller');

UsersListController.$inject = [
  '$scope', '$window', 'Notification', 'allUsers', 'Authentication', 'allRoles', '$compile'
];
export default function UsersListController($scope, $window, Notification, allUsers, Authentication, allRoles, $compile) {
  var vm = this;
  vm.roles = allRoles;
  var superAdminRoleId = (allRoles.find(role => role.name === 'superAdmin'))._id;
  var isSuperAdmin = Authentication.user.userRoles.some((role) => ['superAdmin'].includes(role.name));

  vm.artifactType = 'User';
  vm.artifactTypeLower = 'users';

  allUsers.forEach(user => { user.name = user.displayName; });
  vm.visibleArtifacts = allUsers;

  vm.dataTableColumns = [
    {
      title: 'Signum',
      data: null,
      render: function (data) {
        var dataUserIsSuperAdmin = data.userRoles.some((roleId) => superAdminRoleId === roleId);
        // eslint-disable-next-line max-len
        var htmlElement = (dataUserIsSuperAdmin && !isSuperAdmin) ? `<a>${data.username}</a>` : `<a ui-sref="users.view({ userId: '${data._id}' })">${data.username}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Name',
      data: 'displayName'
    },
    {
      title: 'Account Type',
      data: null,
      render: function (data) {
        var rolesStr = '';
        data.userRoles.forEach(userRoleId => {
          vm.roles.forEach(dbRole => {
            if (dbRole._id === userRoleId) {
              rolesStr += dbRole.name + ' ';
            }
          });
        });
        return rolesStr.trim();
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '175px',
      data: null,
      render: function (data) {
        // Cannot edit superAdmin if logged in user is not superAdmin
        var dataUserIsSuperAdmin = data.userRoles.some((roleId) => superAdminRoleId === roleId);
        if (dataUserIsSuperAdmin && !isSuperAdmin) return '<a></a>';

        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="users.view({ userId: '${data._id}' })">View</a>`;

        // User can edit both admins and superAdmins if they are a superAdmin.
        var adminRoleIds = allRoles.filter(role => ['superAdmin', 'admin'].includes(role.name)).map(role => role._id);
        var userHasAdminRole = data.userRoles.some(role => adminRoleIds.includes(role));
        var hasEditPermissions = Authentication.isAllowed('/users', 'put', true);
        var canEdit = isSuperAdmin || (hasEditPermissions && !userHasAdminRole);
        var editElement = canEdit ? `<a class="btn btn-sm btn-info" ui-sref="users.edit({ userId: '${data._id}' })">Edit</a>` : '<a></a>';

        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;
        return `${compiledView}&nbsp;${compiledEdit}&nbsp;`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}
