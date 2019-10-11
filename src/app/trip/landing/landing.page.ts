import {ChangeDetectionStrategy, Component, Injector, OnInit, ViewChild} from '@angular/core';

import {EntityUtils, environment, isNil, isNotNil} from '../../core/core.module';
import * as moment from "moment";
import {LandingForm} from "./landing.form";
import {Landing, ObservedLocation, PmfmStrategy, Trip, vesselFeaturesToString} from "../services/trip.model";
import {ProgramProperties} from "../../referential/services/model";
import {SamplesTable} from "../sample/samples.table";
import {UsageMode} from "../../core/services/model";
import {LandingService} from "../services/landing.service";
import {AppDataEditorPage} from "../form/data-editor-page.class";
import {FormGroup} from "@angular/forms";
import {EditorDataServiceLoadOptions} from "../../shared/services/data-service.class";
import {ObservedLocationService} from "../services/observed-location.service";
import {TripService} from "../services/trip.service";
import {isEmptyArray, isNotEmptyArray, isNotNilOrBlank} from "../../shared/functions";
import {filter, throttleTime} from "rxjs/operators";
import {Observable} from "rxjs";
import {ReferentialRefService} from "../../referential/services/referential-ref.service";
import {VesselService} from "../../referential/services/vessel-service";

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPage extends AppDataEditorPage<Landing, LandingService> implements OnInit {

  protected parent: Trip | ObservedLocation;
  protected dataService: LandingService;
  protected observedLocationService: ObservedLocationService;
  protected tripService: TripService;
  protected referentialRefService: ReferentialRefService;
  protected vesselService: VesselService;

  @ViewChild('landingForm') landingForm: LandingForm;
  @ViewChild('samplesTable') samplesTable: SamplesTable;

  get pmfms(): Observable<PmfmStrategy[]> {
    return this.landingForm.$pmfms.pipe(filter(isNotNil));
  }

  constructor(
    injector: Injector
  ) {
    super(injector, Landing, injector.get(LandingService));
    this.observedLocationService = injector.get(ObservedLocationService);
    this.tripService = injector.get(TripService);
    this.referentialRefService = injector.get(ReferentialRefService);
    this.vesselService = injector.get(VesselService);
    this.idAttribute = 'landingId';

    // FOR DEV ONLY ----
    this.debug = !environment.production;
  }

  ngOnInit() {
    super.ngOnInit();

    // Watch program, to configure tables from program properties
    this.registerSubscription(
      this.onProgramChanged
        .subscribe(program => {
          if (this.debug) console.debug(`[landing] Program ${program.label} loaded, with properties: `, program.properties);
          this.landingForm.locationLevelIds = program.getPropertyAsNumbers(ProgramProperties.OBSERVED_LOCATION_LOCATION_LEVEL_IDS);
          //this.markForCheck();
        }));

    // Use landing date as default dateTime for samples
    this.registerSubscription(
      this.landingForm.form.controls['dateTime'].valueChanges
        .pipe(throttleTime(200), filter(isNotNil))
        .subscribe((dateTime) => {
          this.samplesTable.defaultSampleDate = dateTime;
        })
    );
  }

  protected registerFormsAndTables() {
    this.registerForms([this.landingForm])
      .registerTables([this.samplesTable]);
  }

  protected async onNewEntity(data: Landing, options?: EditorDataServiceLoadOptions): Promise<void> {
    if (this.isOnFieldMode) {
      data.dateTime = moment();
    }

    data.observedLocationId = options && options.observedLocationId && parseInt(options.observedLocationId);
    data.tripId = options && options.tripId && parseInt(options.tripId);

    this.parent = await this.loadParent(data);

    // Copy from parent into the new object
    if (this.parent) {
      data.program = this.parent.program;
      data.observers = this.parent.observers;
      if (this.parent instanceof ObservedLocation) {
        data.location = this.parent.location;
        data.dateTime = this.parent.startDateTime || this.parent.endDateTime;
        data.tripId = undefined;

        // Load the vessel, if any
        const queryParams = this.route.snapshot.queryParams;
        if (isNotNil(queryParams['vessel'])) {
          const vesselId = +queryParams['vessel'];
          console.debug(`[landing-page] Loading vessel {${vesselId}}...`);
          data.vesselFeatures = await this.vesselService.load(vesselId, {fetchPolicy: 'cache-first'});
        }

      }
      else if (this.parent instanceof Trip) {
        data.vesselFeatures = this.parent.vesselFeatures;
        data.location = this.parent.returnLocation || this.parent.departureLocation;
        data.dateTime = this.parent.returnDateTime || this.parent.departureDateTime;
        data.observedLocationId = undefined;
      }
    }
  }

  protected async onEntityLoaded(data: Landing, options?: EditorDataServiceLoadOptions): Promise<void> {

    this.parent = await this.loadParent(data);

    // COpy not fetched data
    if (this.parent) {
      data.program = EntityUtils.isNotEmpty(data.program) && data.program || this.parent.program;
      data.observers = isNotEmptyArray(data.observers) && data.observers || this.parent.observers;

      if (this.parent instanceof ObservedLocation) {
        data.location = data.location || this.parent.location;
        data.dateTime = data.dateTime || this.parent.startDateTime || this.parent.endDateTime;
        data.tripId = undefined;
      }
      else if (this.parent instanceof Trip) {
        data.vesselFeatures = this.parent.vesselFeatures;
        data.location = data.location || this.parent.returnLocation || this.parent.departureLocation;
        data.dateTime = data.dateTime || this.parent.returnDateTime || this.parent.departureDateTime;
        data.observedLocationId = undefined;
      }
    }
  }

  protected async loadParent(data: Landing): Trip | ObservedLocation {

    // Load parent observed location
    if (isNotNil(data.observedLocationId)) {
      console.debug('[landing-page] Loading parent observed location...');
      return await this.observedLocationService.load(data.observedLocationId, {fetchPolicy: 'cache-first'});
    }
    // Load parent trip
    else if (isNotNil(data.tripId)) {
      console.debug('[landing-page] Loading parent trip...');
      return await this.tripService.load(data.tripId, {fetchPolicy: 'cache-first'});
    }
    else {
      throw new Error('No parent found in path. Landing without parent not implemented yet !');
    }
  }

  protected async getValue(): Promise<Landing> {
    const data = await super.getValue();

    if (this.samplesTable.dirty) {
      await this.samplesTable.save();
    }
    data.samples = this.samplesTable.value;

    return data;
  }

  protected async setValue(data: Landing): Promise<void> {


    const isNew = isNil(data.id);
    if (!isNew) {
      this.programSubject.next(data.program.label);
    }


    this.landingForm.program = data.program.label;
    this.landingForm.value = data;

    this.samplesTable.value = data.samples || [];

    if (this.parent) {
      if (this.parent instanceof ObservedLocation) {
        // Update the back ref link
        this.defaultBackHref = `/observations/${this.parent.id}?tab=1`;

        this.landingForm.showProgram = false;
        this.landingForm.showVessel = true;
        this.landingForm.showLocation = false;
        this.landingForm.showDateTime = true;
        this.landingForm.showObservers = true;

      } else if (this.parent instanceof Trip) {
        // Update the back ref link
        this.defaultBackHref = `/trips/${this.parent.id}`;

        // Hide some fields
        this.landingForm.showProgram = false;
        this.landingForm.showVessel = false;
        this.landingForm.showLocation = true;
        this.landingForm.showDateTime = true;
        this.landingForm.showObservers = true;
      }
    } else {
      this.defaultBackHref = null;

      this.landingForm.showVessel = true;
      this.landingForm.showLocation = true;
      this.landingForm.showDateTime = true;
      this.landingForm.showObservers = true;
    }

  }

  protected async computeTitle(data: Landing): Promise<string> {
    // new data
    if (!data || isNil(data.id)) {
      return await this.translate.get('LANDING.NEW.TITLE').toPromise();
    }

    // Existing data
    return await this.translate.get('LANDING.EDIT.TITLE', {
      vessel: vesselFeaturesToString(data.vesselFeatures)
    }).toPromise();
  }


  protected get form(): FormGroup {
    return this.landingForm.form;
  }

  protected getFirstInvalidTabIndex(): number {
    return this.landingForm.invalid ? 0 : (this.samplesTable.invalid ? 1 : -1);
  }

  protected computeUsageMode(landing: Landing): UsageMode {
    return this.settings.isUsageMode('FIELD')
    && isNotNil(landing && landing.dateTime)
    && landing.dateTime.diff(moment(), "day") <= 1 ? 'FIELD' : 'DESK';
  }

  /* -- protected methods -- */

}
