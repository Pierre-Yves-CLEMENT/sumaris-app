import {defaultDataIdFromObject} from "apollo-cache-inmemory";
import {ApolloLink, NextLink, Operation} from "apollo-link";
import * as uuidv4 from "uuid/v4";
import {EventEmitter} from "@angular/core";
import {debounceTime, filter, switchMap} from "rxjs/operators";
import {PersistedData, PersistentStorage} from "apollo-cache-persist/types";
import {BehaviorSubject, Observable} from "rxjs";
import {ApolloClient} from "apollo-client";
import {environment} from "../../../environments/environment";
import {isNotNil} from "../../shared/functions";

declare let window: any;
const _global = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});
export const NativeWebSocket = _global.WebSocket || _global.MozWebSocket;

/**
 * AppWebSocket class.
 * With a hack on default Websocket, to avoid the use of protocol
 */
export const AppWebSocket = function (url: string, protocols?: string | string[]) {
  return new NativeWebSocket(url/*no protocols*/);
} as any;
AppWebSocket.CLOSED = NativeWebSocket.CLOSED;
AppWebSocket.CLOSING = NativeWebSocket.CLOSING;
AppWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
AppWebSocket.OPEN = NativeWebSocket.OPEN;


/**
 * Custom ID generation, for the GraphQL cache
 * @param object
 */
function dataIdFromObjectProduction(object: Object): string {
  switch (object['__typename']) {

    // For generic VO: add entityName in the cache key (to distinguish by entity)
    case 'ReferentialVO':
    case 'MetierVO':
    case 'PmfmVO':
    case 'TaxonNameVO':
    case 'TaxonGroupVO':
    case 'MeasurementVO':
      if (object['entityName'] && isNotNil(object['id'])) {
        return object['entityName'] + 'VO' + ':' + object['id'];
      }
      break;

    // Join entity (without attribute 'id')
    case 'TaxonGroupStrategyVO':
      return `TaxonGroupStrategyVO:${object['strategyId']}:${dataIdFromObjectProduction(object['taxonGroup'])}`;
    case 'TaxonNameStrategyVO':
      return `TaxonGroupStrategyVO:${object['strategyId']}:${dataIdFromObjectProduction(object['taxonName'])}`;
  }
  return defaultDataIdFromObject(object);
}

function dataIdFromObjectDebug (object: Object): string {
  switch (object['__typename']) {

    // For generic VO: add entityName in the cache key (to distinguish by entity)
    case 'MetierVO':
    case 'PmfmVO':
    case 'TaxonGroupVO':
    case 'TaxonNameVO':
    case 'LocationVO':
    case 'ReferentialVO':
    case 'MeasurementVO':
      if (object['entityName'] && isNotNil(object['id'])) {
        return object['entityName'] + 'VO' + ':' + object['id'];
      }
      console.warn("[dataIdFromObject] Missing attribute 'entityName' or 'id' on an entity. Both are required for graphQL cache. Make sure to fetch it, in GraphQL queries.", object);
      break;

    // Join entity classes (without 'id' attribute)
    case 'TaxonGroupStrategyVO':
      return `TaxonGroupStrategyVO:${object['strategyId']}:${dataIdFromObjectDebug(object['taxonGroup'])}`;
    case 'TaxonNameStrategyVO':
      return `TaxonGroupStrategyVO:${object['strategyId']}:${dataIdFromObjectDebug(object['taxonName'])}`;

    // Fallback to default cache key
    // default:
    //   const res = defaultDataIdFromObject(object);
    //   if (object['__typename'] === 'TripVO') console.debug(`[dataIdFromObject] Computing Trip cache id: {${res}}`);
    //   if (object['__typename'] === 'OperationVO') console.debug(`[dataIdFromObject] Computing Operation cache id: {${res}}`);
    //   return res;
  }
  return defaultDataIdFromObject(object);
}

export const dataIdFromObject = environment.production ? dataIdFromObjectProduction : dataIdFromObjectDebug;

export interface TrackedQuery {
  id: string;
  name: string;
  queryJSON: string;
  variablesJSON: string;
  contextJSON: string;
}

export const TRACKED_QUERIES_STORAGE_KEY = "apollo-tracker-persist";

export function createTrackerLink(opts: {
  storage?: PersistentStorage<PersistedData<TrackedQuery[]>>;
  onNetworkStatusChange: Observable<string>;
  debounce?: number;
  debug?: boolean;
  }): ApolloLink {

  const trackedQueriesUpdated = new EventEmitter();
  const trackedQueriesById: {[id: string]: TrackedQuery} = {};

  const networkStatusSubject = new BehaviorSubject<string>('none');
  opts.onNetworkStatusChange.subscribe(type => networkStatusSubject.next(type));

  // Save pending and tracked queries in storage
  trackedQueriesUpdated.pipe(
    debounceTime(opts.debounce || 1000),
    switchMap(() => networkStatusSubject),
    // Continue if offline
    filter((type) => type === 'none' && !!opts.storage)
  ).subscribe(() => {
      const trackedQueries = Object.getOwnPropertyNames(trackedQueriesById)
        .map(key => trackedQueriesById[key])
        .filter(value => value !== undefined);
      if (opts.debug) console.debug("[apollo-tracker-link] Saving tracked queries to storage", trackedQueries);
      return opts.storage.setItem(TRACKED_QUERIES_STORAGE_KEY, trackedQueries);
    });

  return new ApolloLink((operation: Operation, forward: NextLink) => {
    const context = operation.getContext();

    // Skip if not tracked
    if (!context || !context.tracked) return forward(operation);

    const id = context.serializationKey || uuidv4();
    console.debug(`[apollo-tracker-link] Watching tracked query {${operation.operationName}#${id}}`);

    // Clean context, before calling JSON.stringify (remove unused attributes)
    const cleanContext = { ...context, ...{optimisticResponse: null, cache: null} };

    const trackedQuery: TrackedQuery = {
      id,
      name: operation.operationName,
      queryJSON: JSON.stringify(operation.query),
      variablesJSON: JSON.stringify(operation.variables),
      contextJSON: JSON.stringify(cleanContext)
    };

    // Add to map
    trackedQueriesById[id] = trackedQuery;
    trackedQueriesUpdated.emit();

    const nextOperation = forward(operation)
      .map(data => {
        console.debug(`[apollo-tracker-link] Query {${operation.operationName}#${id}} succeed!`, data);
        delete trackedQueriesById[id];
        trackedQueriesUpdated.emit(trackedQueriesById); // update

        return data;
      });

    // If offline, return the optimistic response
    if (networkStatusSubject.getValue() === 'none') {
      if (context.optimisticResponse) {
        console.debug(`[apollo-tracker-link] Query {${operation.operationName}#${id}} has optimistic response: `, context.optimisticResponse);
      }
      else {
        console.warn(`[apollo-tracker-link] Query {${operation.operationName}#${id}} missing 'context.optimisticResponse': waiting network UP before to continue...`);
      }
    }

    return nextOperation;
  });
}

export async function restoreTrackedQueries(opts: {
  apolloClient: ApolloClient<any>;
  storage: PersistentStorage<PersistedData<TrackedQuery[]>>;
  debug?: boolean;
}) {

  const list = (await opts.storage.getItem(TRACKED_QUERIES_STORAGE_KEY)) as TrackedQuery[];

  if (!list) return;
  if (opts.debug) console.debug("[apollo-tracker-link] Restoring tracked queries", list);

  const promises = (list || []).map(trackedQuery => {
    const context = JSON.parse(trackedQuery.contextJSON);
    const query = JSON.parse(trackedQuery.queryJSON);
    const variables = JSON.parse(trackedQuery.variablesJSON);
    return opts.apolloClient.mutate({
      context,
      mutation: query,
      optimisticResponse: context.optimisticResponse,
      //update: updateHandlerByName[trackedQuery.name],
      variables,
    });
  });

  return Promise.all(promises);
}
