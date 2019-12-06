import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ValidatorService} from "angular4-material-table";
import {VesselValidatorService} from "../../services/vessel.validator";
import {AppTable} from "../../../core/table/table.class";
import {referentialToString, VesselRegistration} from "../../services/model";
import {ActivatedRoute, Router} from "@angular/router";
import {ModalController, Platform} from "@ionic/angular";
import {Location} from "@angular/common";
import {AccountService} from "../../../core/services/account.service";
import {LocalSettingsService} from "../../../core/services/local-settings.service";
import {VesselFilter} from "../../services/vessel-service";
import {AppTableDataSource} from "../../../core/table/table-datasource.class";
import {environment} from "../../../../environments/environment";
import {VesselRegistrationService} from "../../services/vessel-registration.service";
import {VesselRegistrationValidatorService} from "../../services/vessel-registration.validator";

@Component({
  selector: 'app-vessel-registration-history-table',
  templateUrl: './vessel-registration-history.component.html',
  styleUrls: ['./vessel-registration-history.component.scss'],
  providers: [
    {provide: ValidatorService, useClass: VesselValidatorService}
  ],
})
export class VesselRegistrationHistoryComponent extends AppTable<VesselRegistration, VesselFilter> implements OnInit {

  referentialToString = referentialToString;
  isAdmin: boolean;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: Platform,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected accountService: AccountService,
    protected settings: LocalSettingsService,
    protected vesselRegistrationValidator: VesselRegistrationValidatorService,
    protected vesselRegistrationService: VesselRegistrationService,
    protected cd: ChangeDetectorRef) {

    super(route, router, platform, location, modalCtrl, settings,
      // columns
      ['id',
        'startDate',
        'endDate',
        'registrationCode',
        'registrationLocation']
      ,
      new AppTableDataSource<VesselRegistration, VesselFilter>(VesselRegistration, vesselRegistrationService, vesselRegistrationValidator, {
        prependNewElements: false,
        suppressErrors: environment.production,
        serviceOptions: {
          saveOnlyDirtyRows: true
        }
      })
    );

    this.i18nColumnPrefix = 'VESSEL.';

    this.autoLoad = false;
    this.inlineEdition = false;
    this.confirmBeforeDelete = true;

  }

  ngOnInit() {
    super.ngOnInit();

    this.isAdmin = this.accountService.isAdmin();
  }

}