import { core } from '../../modules/core/client/core.client.module';
import { roles } from '../../modules/roles/client/roles.client.module';
import { users } from '../../modules/users/client/users.client.module';
import { history } from '../../modules/history/client/history.client.module';
import { areas } from '../../modules/areas/client/areas.client.module';
import { programs } from '../../modules/programs/client/programs.client.module';
import { productFlavours } from '../../modules/product_flavours/client/product_flavours.client.module';
import { productTypes } from '../../modules/product_types/client/product_types.client.module';
import { labels } from '../../modules/labels/client/labels.client.module';
import { hardware } from '../../modules/hardware/client/hardware.client.module';
import { products } from '../../modules/products/client/products.client.module';
import { deployments } from '../../modules/deployments/client/deployments.client.module';
import { bookings } from '../../modules/bookings/client/bookings.client.module';
import { teams } from '../../modules/teams/client/teams.client.module';
import { statistics } from '../../modules/statistics/client/statistics.client.module';

export default [
  core,
  roles,
  users,
  history,
  areas,
  programs,
  productFlavours,
  productTypes,
  labels,
  hardware,
  products,
  deployments,
  bookings,
  teams,
  statistics
];
