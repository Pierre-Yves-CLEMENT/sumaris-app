import {Injectable} from "@angular/core";
import {ValidatorService} from "angular4-material-table";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {SharedValidators} from "../../shared/validator/validators";

@Injectable()
export class BatchGroupValidatorService implements ValidatorService {

  constructor(
    private formBuilder: FormBuilder) {
  }

  getRowValidator(): FormGroup {
    return this.getFormGroup();
  }

  getFormGroup(data?: any): FormGroup {
    return this.formBuilder.group({
      __typename: ['BatchVO'],
      id: [''],
      updateDate: [''],
      rankOrder: ['1', Validators.required],
      label: [data && data.label || ''],
      individualCount: ['', Validators.compose([Validators.min(0), SharedValidators.integer])],
      samplingRatio: ['', SharedValidators.double()],
      samplingRatioText: [''],
      taxonGroup: ['', SharedValidators.entity],
      taxonName: ['', SharedValidators.entity],
      comments: [''],
      parent: ['', SharedValidators.entity],
      measurementValues: this.formBuilder.group({}),
      children: this.formBuilder.array([])
    });
  }
}
