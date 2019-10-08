import {NgModule} from '@angular/core';
import {ActivatedRouteSnapshot, ExtraOptions, RouteReuseStrategy, RouterModule, Routes} from '@angular/router';
import {HomePage} from './core/home/home';
import {RegisterConfirmPage} from './core/register/confirm/confirm';
import {AccountPage} from './core/account/account';
import {VesselsPage} from './referential/vessel/list/vessels';
import {VesselPage} from './referential/vessel/page/page-vessel';
import {ReferentialsPage} from './referential/list/referentials';
import {TripPage, TripsPage} from './trip/trip.module';
import {OperationPage} from './trip/operation/operation.page';
import {SoftwarePage} from './referential/software/software.page';
import {ObservedLocationPage} from "./trip/observedlocation/observed-location.page";
import {ObservedLocationsPage} from "./trip/observedlocation/observed-locations.page";
import {SettingsPage} from "./core/settings/settings.page";
import {LandingPage} from "./trip/landing/landing.page";
import {AuctionControlLandingPage} from "./trip/landing/auctioncontrol/auction-control-landing.page";
import {SubBatchesModal} from "./trip/batch/sub-batches.modal";
import {IonicRouteStrategy} from "@ionic/angular";
import {ProgramPage} from "./referential/program/program.page";
import {BatchGroupPage} from "./trip/batch/batch-group.page";
import {AuthGuardService} from "./core/services/auth-guard.service";

const routeOptions: ExtraOptions = {
  enableTracing: false,
  //enableTracing: !environment.production,
  useHash: false
};

const routes: Routes = [
  // Core path
  {
    path: '',
    component: HomePage
  },

  {
    path: 'home/:action',
    component: HomePage
  },
  {
    path: 'confirm/:email/:code',
    component: RegisterConfirmPage
  },
  {
    path: 'account',
    pathMatch: 'full',
    component: AccountPage,
    canActivate: [AuthGuardService]
  },
  {
    path: 'settings',
    pathMatch: 'full',
    component: SettingsPage
  },

  // Admin
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  },

  // Referential path
  {
    path: 'referential',
    canActivate: [AuthGuardService],
    children: [
      {
        path: 'list',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: ReferentialsPage,
            data: {
              profile: 'ADMIN'
            }
          }
        ]
      },
      {
        path: 'vessels',
        children: [
          {
            path: '',
            component: VesselsPage,
            data: {
              profile: 'USER'
            }
          },
          {
            path: ':id',
            component: VesselPage,
            data: {
              profile: 'USER'
            }
          }
        ]
      },
      {
        path: 'program/:id',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: ProgramPage,
            data: {
              profile: 'ADMIN'
            }
          }
        ]
      },
      {
        path: 'software/:id',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: SoftwarePage,
            data: {
              profile: 'ADMIN'
            }
          }
        ]
      }
    ]
  },

  // Trip path
  {
    path: 'trips',
    canActivate: [AuthGuardService],
    data: {
      profile: 'USER'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: TripsPage
      },
      {
        path: ':tripId',
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          pathIdParam: 'tripId'
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: TripPage,
            runGuardsAndResolvers: 'pathParamsChange'
          },
          {
            path: 'operations/:operationId',
            runGuardsAndResolvers: 'pathParamsChange',
            data: {
              pathIdParam: 'operationId'
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                component: OperationPage,
                runGuardsAndResolvers: 'pathParamsChange'
              },
              {
                path: 'batches',
                component: SubBatchesModal,
                runGuardsAndResolvers: 'pathParamsChange'
              },
              {
                path: 'batch/:batchId',
                component: BatchGroupPage,
                runGuardsAndResolvers: 'pathParamsChange',
                data: {
                  pathIdParam: 'batchId'
                },
              }
            ]
          }
        ]
      },

      {
        path: ':tripId/landing/:landingId',
        component: LandingPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER',
          pathIdParam: 'landingId'
        }
      }
    ]
  },

  // Observations path
  {
    path: 'observations',
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ObservedLocationsPage,
        data: {
          profile: 'USER'
        }
      },
      {
        path: ':observedLocationId',
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          pathIdParam: 'observedLocationId'
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: ObservedLocationPage,
            runGuardsAndResolvers: 'pathParamsChange'
          },
          // {
          //   path: 'batches',
          //   component: SubBatchesModal,
          //   runGuardsAndResolvers: 'pathParamsChange'
          // },
          {
            path: 'landing/:landingId',
            runGuardsAndResolvers: 'pathParamsChange',
            data: {
              pathIdParam: 'landingId'
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                component: LandingPage,
                runGuardsAndResolvers: 'pathParamsChange'
              }
            ]
          },
          {
            path: 'control/:landingId',
            runGuardsAndResolvers: 'pathParamsChange',
            data: {
              pathIdParam: 'landingId'
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                component: AuctionControlLandingPage,
                runGuardsAndResolvers: 'pathParamsChange'
              }
            ]
          }
        ]
      }
    ]
  },

  {
    path: 'output',
    loadChildren: () => import('./output/output.module').then(m => m.OutputModule)
  },

  {
    path: "**",
    redirectTo: '/'
  },
];

export class CustomReuseStrategy extends IonicRouteStrategy {

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    const res = super.shouldReuseRoute(future, curr);

    // Reuse the route if path change from [/new] -> [/:id]
    if (!res && future.routeConfig && future.routeConfig === curr.routeConfig) {
      const pathIdParam = future.routeConfig.data && future.routeConfig.data.pathIdParam || 'id';
      const futureId = future.params[pathIdParam] === 'new' ?
        (future.queryParams[pathIdParam] || future.queryParams['id']) : future.params[pathIdParam];
      const currId = curr.params[pathIdParam] === 'new' ?
        (curr.queryParams[pathIdParam] || curr.queryParams['id']) : curr.params[pathIdParam];
      //if (futureId !== currId) console.log("TODO: shouldReuseRoute -> NOT same page. Will not reused");
      return futureId === currId;
    }
    return res;
  }
}

@NgModule({
  imports: [
    RouterModule.forRoot(routes, routeOptions)
  ],
  exports: [
    RouterModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ]
})
export class AppRoutingModule {
}
