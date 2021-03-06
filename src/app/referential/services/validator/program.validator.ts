import {Injectable} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Program} from "../model/program.model";

import {ValidatorService} from "angular4-material-table";
import {SharedValidators} from "../../../shared/validator/validators";
import {EntityUtils} from "../../../core/services/model/entity.model";

@Injectable()
export class ProgramValidatorService implements ValidatorService {

  constructor(
    protected formBuilder: FormBuilder
  ) {
  }

  getRowValidator(): FormGroup {
    return this.getFormGroup();
  }

  getFormGroup(data?: Program): FormGroup {
    return this.formBuilder.group({
      id: [data && data.id || null],
      updateDate: [data && data.updateDate || null],
      creationDate: [data && data.creationDate || null],
      statusId: [data && data.statusId || null, Validators.required],
      label: [data && data.label || null, Validators.required],
      name: [data && data.name || null, Validators.required],
      description: [data && data.description || null, Validators.maxLength(255)],
      comments: [data && data.comments || null, Validators.maxLength(2000)],
      taxonGroupType: [data && data.taxonGroupType || null, Validators.compose([Validators.required, SharedValidators.entity])],
      gearClassification: [data && data.gearClassification || null, Validators.compose([Validators.required, SharedValidators.entity])],
      locationClassifications: this.formBuilder.array([]),
      locations: this.formBuilder.array([]),
      properties: this.getPropertiesArray(data && data.properties)
    });
  }

  getPropertiesArray(array?: any) {
    const properties = (array && array instanceof Array) ? array : EntityUtils.getObjectAsArray(array || {});
    return this.formBuilder.array(
      properties.map(item => this.getPropertyFormGroup(item))
    );
  }

  getPropertyFormGroup(data?: {key: string; value?: string;}): FormGroup {
    return this.formBuilder.group({
      key: [data && data.key || null, Validators.compose([Validators.required, Validators.max(50)])],
      value: [data && data.value || null, Validators.compose([Validators.required, Validators.max(100)])]
    });
  }
}
