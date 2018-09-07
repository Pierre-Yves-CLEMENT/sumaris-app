import { Component, OnInit, ViewChild, QueryList, ViewChildren } from '@angular/core';
import { Router, ActivatedRoute, Params, NavigationEnd } from "@angular/router";
import { MatTabChangeEvent } from "@angular/material";
import { TripService } from '../services/trip-service';
import { TripForm } from '../form/form-trip';
import { Trip, Sale } from '../services/model';
import { FormGroup } from '@angular/forms';
import { SaleForm } from '../sale/form/form-sale';
import { OperationTable } from '../operation/table/table-operations';
import { Observable } from "rxjs-compat";
import { PhysicalGearForm } from '../physicalGear/form/form-physical-gear';
import { MeasurementsForm } from '../measurement/form/form-measurements';
import { AppForm, AppTable } from '../../core/core.module';
import { PhysicalGearTable } from '../physicalGear/table/table-physical-gears';

@Component({
  selector: 'page-trip',
  templateUrl: './page-trip.html',
  styleUrls: ['./page-trip.scss']
})
export class TripPage implements OnInit {


  private forms: AppForm<any>[];
  private tables: AppTable<any, any>[];

  selectedTabIndex: number = 0;

  submitted: boolean = false;
  error: string;
  loading: boolean = true;
  saving: boolean = false;
  data: Trip;

  @ViewChild('tripForm') tripForm: TripForm;

  @ViewChild('saleForm') saleForm: SaleForm;


  @ViewChild('physicalGearTable') physicalGearTable: PhysicalGearTable;

  @ViewChild('measurementsForm') measurementsForm: MeasurementsForm;

  @ViewChild('operationTable') operationTable: OperationTable;

  public get dirty(): boolean {
    return this.forms && (!!this.forms.find(form => form.dirty) || !!this.tables.find(table => table.dirty));
  }

  public get valid(): boolean {
    return !this.forms || (!this.forms.find(form => !form.valid) && !this.tables.find(table => !table.valid));
  }

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected tripService: TripService
  ) {
  }

  ngOnInit() {
    // Make sure template has a form
    if (!this.tripForm || !this.saleForm) throw "[TripPage] no form for value setting";

    this.forms = [this.tripForm, this.saleForm, this.measurementsForm];
    this.tables = [this.physicalGearTable, this.operationTable];

    this.disable();

    // Listen route parameters
    this.route.queryParams.subscribe(res => {
      const tabIndex = res["tab"];
      if (tabIndex !== undefined) {
        this.selectedTabIndex = parseInt(tabIndex);
      }
    });

    this.route.params.subscribe(res => {
      const id = res && res["tripId"];
      if (!id || id === "new") {
        this.load();
      }
      else {
        this.load(parseInt(id));
      }
    });
  }

  async load(id?: number) {
    this.error = null;
    if (id) {
      this.tripService.load(id)
        .subscribe(data => {
          this.updateView(data, true);
          this.enable();
          this.loading = false;
        });
    }
    else {
      console.debug("[page-trip] Creating new trip...");
      this.updateView(new Trip(), true);
      this.enable();
      this.loading = false;
    }
  }

  updateView(data: Trip | null, updateOperations?: boolean) {
    this.data = data;
    this.tripForm.value = data;
    this.saleForm.value = data && data.sale;
    this.measurementsForm.value = data && data.measurements || [];

    this.physicalGearTable.value = data && data.gears || [];

    if (updateOperations) {
      this.operationTable && this.operationTable.setTrip(data);
    }

    this.markAsPristine();
    this.markAsUntouched();
  }

  async save(event): Promise<any> {
    if (this.loading || this.saving) return;

    // Copy vessel features, before trying to validate saleForm
    if (this.tripForm.valid) {
      this.saleForm.form.controls['vesselFeatures'].setValue(this.tripForm.form.controls['vesselFeatures'].value);
    }


    // Not valid
    if (!this.valid) {
      this.submitted = true;
      return;
    }
    this.saving = true;

    console.log("[page-trip] Saving...");

    // Update Trip from JSON
    let json = this.tripForm.value;
    json.sale = !this.saleForm.empty ? this.saleForm.value : null;
    this.data.fromObject(json);
    this.data.gears = this.physicalGearTable.value;
    this.data.measurements = this.measurementsForm.value;

    const formDirty = this.dirty;
    this.disable();

    try {
      // Save trip form (with sale) 
      const updatedData = formDirty ? await this.tripService.save(this.data) : this.data;
      formDirty && this.markAsPristine();
      formDirty && this.markAsUntouched();

      // Save operations
      const isOperationSaved = !this.operationTable || await this.operationTable.save();
      isOperationSaved && this.operationTable && this.operationTable.markAsPristine();

      // Update the view (e.g metadata)
      this.updateView(updatedData, false);
      return updatedData;
    }
    catch (err) {
      console.error(err);
      this.submitted = true;
      this.error = err && err.message || err;
    }
    finally {
      this.enable();
      this.submitted = false;
      this.saving = false;
    }
  }

  public disable() {
    this.forms && this.forms.forEach(form => form.disable());
    this.tables && this.tables.forEach(table => table.disable());
  }

  public enable() {
    this.forms && this.forms.forEach(form => form.enable());
    this.tables && this.tables.forEach(table => table.enable());
  }

  public markAsPristine() {
    this.error = null;
    this.forms && this.forms.forEach(form => form.markAsPristine());
    this.tables && this.tables.forEach(table => table.markAsPristine());
  }

  public markAsUntouched() {
    this.forms && this.forms.forEach(form => form.markAsUntouched());
    this.tables && this.tables.forEach(table => table.markAsUntouched());
  }

  async cancel() {
    // reload
    this.loading = true;
    await this.load(this.data.id);
  }

  onTabChange(event: MatTabChangeEvent) {
    const queryParams: Params = Object.assign({}, this.route.snapshot.queryParams);
    queryParams['tab'] = event.index;
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: queryParams
    });
  }


}
