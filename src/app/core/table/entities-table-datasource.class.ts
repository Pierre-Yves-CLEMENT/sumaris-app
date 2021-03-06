import {TableDataSource, TableElement, ValidatorService} from 'angular4-material-table';
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {isNotEmptyArray, isNotNil, LoadResult, EntitiesService, toBoolean} from '../../shared/shared.module';
import {Entity, IEntity} from "../services/model/entity.model";
import {ErrorCodes} from '../services/errors';
import {catchError, first, map, takeUntil} from "rxjs/operators";
import {Directive, OnDestroy} from "@angular/core";
import {EntitiesServiceWatchOptions} from "../../shared/services/entity-service.class";
import {SortDirection} from "@angular/material/sort";
import {CollectionViewer} from "@angular/cdk/collections";
import {firstNotNilPromise} from "../../shared/observables";


export declare interface AppTableDataServiceOptions<O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions> extends EntitiesServiceWatchOptions {
  saveOnlyDirtyRows?: boolean;
  readOnly?: boolean;
  [key: string]: any;
}
export declare interface AppTableDataSourceOptions<T extends Entity<T>, O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions> {
  prependNewElements: boolean;
  suppressErrors: boolean;
  onRowCreated?: (row: TableElement<T>) => Promise<void> | void;
  dataServiceOptions?: AppTableDataServiceOptions<O>;
  [key: string]: any;
}

@Directive()
export class EntitiesTableDataSource<T extends IEntity<T>, F, O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions>
    extends TableDataSource<T>
    implements OnDestroy {

  protected _debug = false;
  protected _config: AppTableDataSourceOptions<T, O>;
  protected _creating = false;
  protected _saving = false;
  protected _useValidator = false;
  protected _stopWatchAll$ = new Subject();
  private _loaded = false;

  $busy = new BehaviorSubject(false);

  get serviceOptions(): AppTableDataServiceOptions<O> {
    return this._config.dataServiceOptions;
  }

  set serviceOptions(value: AppTableDataServiceOptions<O>)  {
    this._config.dataServiceOptions = value;
  }

  get options(): AppTableDataSourceOptions<T, O> {
    return this._config;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  /**
   * Creates a new TableDataSource instance, that can be used as datasource of `@angular/cdk` data-table.
   * @param data Array containing the initial values for the TableDataSource. If not specified, then `dataType` must be specified.
   * @param dataService A service to load and save data
   * @param dataType Type of data contained by the Table. If not specified, then `data` with at least one element must be specified.
   * @param validatorService Service that create instances of the FormGroup used to validate row fields.
   * @param config Additional configuration for table.
   */
  constructor(dataType: new() => T,
              public readonly dataService: EntitiesService<T, F, O>,
              validatorService?: ValidatorService,
              config?: AppTableDataSourceOptions<T, O>) {
    super([], dataType, validatorService, config);
    this._config = {
      prependNewElements: false,
      suppressErrors: true,
      dataServiceOptions: {},
      ...config
    };
    this._useValidator = isNotNil(validatorService);


    // For DEV ONLY
    //this._debug = !environment.production;
  }

  ngOnDestroy() {
    this._stopWatchAll$.next();
    // Unsubscribe from the subject
    this._stopWatchAll$.unsubscribe();
    this.$busy.unsubscribe();
  }

  watchAll(offset: number,
           size: number,
           sortBy?: string,
           sortDirection?: SortDirection,
           filter?: F): Observable<LoadResult<T>> {

    this._stopWatchAll$.next(); // stop previous watch observable

    this.$busy.next(true);
    return this.dataService.watchAll(offset, size, sortBy, sortDirection, filter, this.serviceOptions as O)
      .pipe(
        // Stop this pipe next time we call watchAll()
        takeUntil(this._stopWatchAll$),
        catchError(err => this.handleError(err, 'ERROR.LOAD_DATA_ERROR')),
        map((res: LoadResult<T>) => {
          if (this._saving) {
            console.error(`[table-datasource] Service ${this.dataService.constructor.name} sent data, while will saving... should skip ?`);
          } else {
            this.$busy.next(false);
            if (this._debug) console.debug(`[table-datasource] Service ${this.dataService.constructor.name} sent new data: updating datasource...`, res);
            this.updateDatasource((res.data || []) as T[]);
          }
          return res;
        })
      );
  }

  async save(): Promise<boolean> {
    if (toBoolean(this.serviceOptions.readOnly, false)) {
      console.error("[table-datasource] Enable to save, because serviceOptions.readOnly=true");
      return false;
    }
    if (this._saving) {
      console.error("[table-datasource] Trying to save twice. Should never occur !");
      return false;
    }

    this._saving = true;
    this.$busy.next(true);

    const onlyDirtyRows = toBoolean(this.serviceOptions.saveOnlyDirtyRows, false);

    try {
      if (this._debug) console.debug(`[table-datasource] Saving rows... (onlyDirty=${onlyDirtyRows})`);

      // Get all rows
      const rows = await this.getRows();

      // Finish editing all rows, and log row in error
      const invalidRows = rows.filter(row => row.editing && !row.confirmEditCreate());
      if (invalidRows.length) {
        // log errors
        if (this._debug) invalidRows.forEach(this.logRowErrors);
        // Stop with an error
        throw {code: ErrorCodes.TABLE_INVALID_ROW_ERROR, message: 'ERROR.TABLE_INVALID_ROW_ERROR'};
      }

      let data: T[];
      let dataToSave: T[];

      if (this._useValidator) {
        dataToSave = [];
        data = rows.map(row => {
          const currentData = new this.dataConstructor() as T;
          currentData.fromObject(row.currentData);
          // Filter to keep only dirty row
          if (onlyDirtyRows && row.validator.dirty) dataToSave.push(currentData);
          return currentData;
        });
        if (!onlyDirtyRows) dataToSave = data;
      }
      // Or use the current data without conversion (when no validator service used)
      else {
        data = rows.map(row => row.currentData);
        // save all data, as we don't have any dirty marker
        dataToSave = data;
      }

      // If no data to save: exit
      if (onlyDirtyRows && !dataToSave.length) {
        if (this._debug) console.debug('[table-datasource] No row to save');
        return false;
      }

      if (this._debug) console.debug('[table-datasource] Row to save:', dataToSave);

      const savedData = await this.dataService.saveAll(dataToSave, this.serviceOptions);

      if (this._debug) console.debug('[table-datasource] Data saved. Updated data received by service:', savedData);
      if (this._debug) console.debug('[table-datasource] Updating datasource...', data);
      this.updateDatasource(data, {emitEvent: false});
      return true;
    } catch (error) {
      if (this._debug) console.error('[table-datasource] Error while saving: ' + error && error.message || error);
      throw error;
    } finally {
      this._saving = false;
      // Always update the loading indicator
      this.$busy.next(false);
    }
  }

  updateDatasource(data: T[], options?: { emitEvent: boolean }) {
    super.updateDatasource(data, options);
    this._loaded = true;
  }

  // Overwrite default signature
  createNew(): void {
    this.asyncCreateNew();
  }

  disconnect(collectionViewer?: CollectionViewer) {
    super.disconnect(collectionViewer);
    this._stopWatchAll$.next();
  }

  confirmCreate(row: TableElement<T>) {
    if (!super.confirmCreate(row)) return false;
    if (row.editing && row.validator) {
      console.warn('[table-datasource] Row has editing=true after confirmCreate! Force set to false');
      row.validator.disable({onlySelf: true, emitEvent: false});
    }
    return true;
  }

  confirmEdit(row: TableElement<T>): boolean {
    if (!super.confirmEdit(row)) return false;
    if (row.editing && row.validator) {
      console.warn('[table-datasource] Row has editing=true after confirmCreate! Force set to false');
      row.validator.disable({onlySelf: true, emitEvent: false});
    }
    return true;
  }

  startEdit(row: TableElement<T>) {
    if (this._debug) console.debug("[table-datasource] Start to edit row", row);
    row.startEdit();
  }

  cancelOrDelete(row: TableElement<T>) {
    if (this._debug) console.debug("[table-datasource] Cancelling or deleting row", row);
    row.cancelOrDelete();
  }

  public handleError(error: any, message: string): Observable<LoadResult<T>> {
    const errorMsg = error && error.message || error;
    console.error(`${errorMsg} (dataService: ${this.dataService.constructor.name})`, error);
    this.$busy.next(false);
    throw new Error(message || errorMsg);
  }

  public handleErrorPromise(error: any, message: string) {
    const errorMsg = error && error.message || error;
    console.error(`${errorMsg} (dataService: ${this.dataService.constructor.name})`, error);
    this.$busy.next(false);
    throw new Error(message || errorMsg);
  }

  public delete(id: number): void {
    const row = this.getRow(id);
    this.$busy.next(true);

    this.dataService.deleteAll([row.currentData], this.serviceOptions)
      .catch(err => this.handleErrorPromise(err, 'Unable to delete row'))
      .then(() => {
        setTimeout(() => {
          // make sure row has been deleted (because GrapQHl cache remove can failed)
          const present = this.getRow(id) === row;
          if (present) super.delete(id);
          this.$busy.next(false);
        }, 300);
      });
  }

  public deleteAll(rows: TableElement<T>[]): Promise<any> {
    this.$busy.next(true);

    const data = rows.map(r => r.currentData);
    const rowsById = rows.reduce((res, row) => {
      res[row.id] = row;
      return res;
    }, {});
    const self = this;
    const selfDelete = super.delete;

    return this.dataService.deleteAll(data, this.serviceOptions)
      .catch(err => this.handleErrorPromise(err, 'Unable to delete row'))
      .then(() => {
        // Workaround, to be sure all rows has been deleted
        // Sometimes, the service miss deletion, or GrapQHl cache remove failed
        const rowNotDeleted = Object.getOwnPropertyNames(rowsById).reduce((res, id) => {
          const row = rowsById[id];
          const present = self.getRow(+id) === row;
          return present ? res.concat(row) : res;
        }, []).sort((a, b) => a.id > b.id ? -1 : 1);
        // Apply missing deletion
        if (isNotEmptyArray(rowNotDeleted)) {
          console.warn(`[table-datasource] Force deletion of ${rowNotDeleted.length} rows (Is service applying deletion to observable ?)`);
          rowNotDeleted.forEach(r => selfDelete.call(self, r.id));
        }
        this.$busy.next(false);
      });
  }

  public getRows(): Promise<TableElement<T>[]> {
    return firstNotNilPromise(this.connect(null)) as Promise<TableElement<T>[]>;
  }

  public async asyncCreateNew(): Promise<void> {
    if (this._creating) return; // Avoid multiple call
    this._creating = true;
    super.createNew();
    const row = this.getRow(-1);

    if (row && this._config && this._config.onRowCreated) {
      const res = this._config.onRowCreated(row);
      // If async function, wait the end before ending
      if (res instanceof Promise) {
        try {
          await res;
        }
        catch(err)  {
          console.error(err && err.message | err, err);
        }
      }
    }

    this._creating = false;
  }

  /* -- protected method -- */

  protected logRowErrors(row: TableElement<T>): void {

    if (!row.validator || !row.validator.hasError) return;

    let errorsMessage = "";
    Object.getOwnPropertyNames(row.validator.controls)
      .forEach(key => {
        let control = row.validator.controls[key];
        if (control.invalid) {
          errorsMessage += "'" + key + "' (" + (control.errors ? Object.getOwnPropertyNames(control.errors) : 'unknown error') + "),";
        }
      });

    if (errorsMessage.length) {
      console.error("[table-datasource] Row (id=" + row.id + ") has errors: " + errorsMessage.slice(0, -1));
    }
  }
}
