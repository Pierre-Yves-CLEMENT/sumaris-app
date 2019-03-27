import {Injectable} from "@angular/core";
import {BaseDataService} from "../../core/services/base.data-service.class";
import {DataService, LoadResult} from "../../shared/services/data-service.class";
import {Apollo} from "apollo-angular";
import {AccountService} from "../../core/services/account.service";
import {Observable} from "rxjs";
import {Moment} from "moment";
import {environment} from "../../../environments/environment";
import {ObservedLocation} from "./observed-location.model";


export declare class ObservedLocationFilter {
  programLabel?: string;
  startDate?: Date | Moment;
  endDate?: Date | Moment;
  locationId?: number;
}

@Injectable()
export class ObservedLocationService extends BaseDataService implements DataService<ObservedLocation, ObservedLocationFilter> {

  constructor(
    protected apollo: Apollo,
    protected accountService: AccountService
  ) {
    super(apollo);

    // FOR DEV ONLY
    this._debug = !environment.production;
  }

  loadAll(offset: number, size: number, sortBy?: string, sortDirection?: string, filter?: ObservedLocationFilter, options?: any): Observable<LoadResult<ObservedLocation>> {

    const now = Date.now();
    console.debug("[sale-control] Loading sale controls...");

    // Mock
    if (environment.mock) return Observable.of(this.getMockData());

    // TODO
    return Observable.empty();
  }

  load(id: number): Observable<ObservedLocation> {

    const now = Date.now();
    console.debug(`[sale-control] Loading sale control {${id}}...`);

    // Mock
    if (environment.mock) {
      const saleControl:ObservedLocation = this.getMockData().data.find(sc => sc.id === id);
      return Observable.of(saleControl);
    }

    // TODO
    return Observable.empty();
  }

  async save(data: ObservedLocation): Promise<ObservedLocation> {
    console.warn("TODO: save observed location");
    // TODO
    return data;
  }

  async saveAll(data: ObservedLocation[], options?: any): Promise<ObservedLocation[]> {
    // TODO:
    return [];
  }

  async deleteAll(data: ObservedLocation[], options?: any): Promise<any> {
    // TODO:
    return {};
  }

  canUserWrite(date: ObservedLocation): boolean {
    if (!date) return false;

    // If the user is the recorder: can write
    if (date.recorderPerson && this.accountService.account.equals(date.recorderPerson)) {
      return true;
    }

    // TODO: check rights on program (need model changes)

    return this.accountService.canUserWriteDataForDepartment(date.recorderDepartment);
  }

  /* -- private -- */

  getMockData(): LoadResult<ObservedLocation> {
    const recorderPerson = {id: 1, firstName:'Benoit', lastName: 'Lavenier'};
    const observers = [recorderPerson];
    const location = {id: 30, label:'FRDRZ', name:'Douarnenez'};

    const data = [
        ObservedLocation.fromObject({
          id:1,
          program:  {id: 11, label:'ADAP-CONTROLE', name:'Contrôle en criée'},
          startDateTime: '2019-01-01T03:50:00.000Z',
          location: location,
          recorderPerson: recorderPerson,
          observers: observers,
          sales: [
            {
              id: 100,
              startDateTime: '2019-01-01T03:50:00.000Z',
              location: location,
              vesselFeatures: {id: 1, vesselId:1, name:'Vessel 1', exteriorMarking:'FRA000851751'}
            }
          ]
        }),
        ObservedLocation.fromObject({
          id:2,
          program:  {id: 11, label:'ADAP-CONTROLE', name:'Contrôle en criée'},
          startDateTime: '2019-01-01T03:50:00.000Z',
          location: {id: 30, label:'FRDRZ', name:'Douarnenez'},
          recorderPerson: recorderPerson,
          observers: observers
        }),
        ObservedLocation.fromObject({
          id:3,
          program:  {id: 11, label:'ADAP-CONTROLE', name:'Contrôle en criée'},
          startDateTime: '2019-01-01T03:50:00.000Z',
          location: {id: 30, label:'FRDRZ', name:'Douarnenez'},
          recorderPerson: recorderPerson,
          observers: observers
        }),
        ObservedLocation.fromObject({
          id:4,
          program:  {id: 11, label:'ADAP-CONTROLE', name:'Contrôle en criée'},
          startDateTime: '2019-01-01T03:50:00.000Z',
          location: {id: 30, label:'FRDRZ', name:'Douarnenez'},
          recorderPerson: recorderPerson,
          observers: observers
        }),
      ];

    return {
      total: data.length,
      data
    };
  }
}