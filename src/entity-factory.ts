import * as Faker from 'faker';
import { Connection, ObjectType } from 'typeorm';

import { FactoryFunction, EntityProperty } from './types';
import { isPromiseLike } from './utils';

export class EntityFactory<Entity, Settings> {

  private mapFunction: (entity: Entity) => Promise<Entity>;

  constructor(
    public name: string,
    public entity: ObjectType<Entity>,
    private factory: FactoryFunction<Entity, Settings>,
    private settings?: Settings
  ) { }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * This function is used to alter the generated values of entity, before it
   * is persist into the database
   */
  public map(mapFunction: (entity: Entity) => Promise<Entity>): EntityFactory<Entity, Settings> {
    this.mapFunction = mapFunction;
    return this;
  }

  /**
   * Make a new entity, but does not persist it
   */
  public async make(overrideParams: EntityProperty<Entity> = {}): Promise<Entity> {
    if (this.factory) {
      let entity = await this.resolveEntity(this.factory(Faker, this.settings));
      if (this.mapFunction) {
        entity = await this.mapFunction(entity);
      }

      for (const key in overrideParams) {
        entity[key] = overrideParams[key];
      }

      return entity;
    }
    throw new Error('Could not found entity');
  }

  /**
   * Seed makes a new entity and does persist it
   */
  public async seed(overrideParams: EntityProperty<Entity> = {}): Promise<Entity> {
    const connection: Connection = (global as any).seeder.connection;
    if (connection) {
      const em = connection.createEntityManager();
      try {
        const entity = await this.make(overrideParams);
        return await em.save<Entity>(entity);
      } catch (error) {
        throw new Error('Could not save entity');
      }
    } else {
      throw new Error('No db connection is given');
    }
  }

  public async makeMany(amount: number, overrideParams: EntityProperty<Entity> = {}): Promise<Entity[]> {
    const list = [];
    for (let index = 0; index < amount; index++) {
      list[index] = await this.make(overrideParams);
    }
    return list;
  }

  public async seedMany(amount: number, overrideParams: EntityProperty<Entity> = {}): Promise<Entity[]> {
    const list = [];
    for (let index = 0; index < amount; index++) {
      list[index] = await this.seed(overrideParams);
    }
    return list;
  }

  // -------------------------------------------------------------------------
  // Prrivat Helpers
  // -------------------------------------------------------------------------

  private async resolveEntity(entity: Entity): Promise<Entity> {
    for (const attribute in entity) {
      if (entity.hasOwnProperty(attribute)) {
        if (isPromiseLike(entity[attribute])) {
          entity[attribute] = await entity[attribute];
        }

        if (typeof entity[attribute] === 'object' && !(entity[attribute] instanceof Date)) {
          const subEntityFactory = entity[attribute];
          try {
            entity[attribute] = await (subEntityFactory as any).make();
          } catch (e) {
            throw new Error(`Could not make ${(subEntityFactory as any).name}`);
          }
        }
      }
    }
    return entity;
  }

}
