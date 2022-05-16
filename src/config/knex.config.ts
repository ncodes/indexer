import { registerAs } from '@nestjs/config';
import * as knexJSON from '../../knexfile';

export default registerAs('knex', () => knexJSON);
