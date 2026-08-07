export type TripStepId =
  | 'arrived_shipper'
  | 'loaded_shipper'
  | 'arrived_receiver'
  | 'delivered_receiver'
  | 'destination_arrival';

export type TripStepStatus = 'completed' | 'active' | 'pending';

export interface TripStep {
  id: TripStepId;
  label: string;
  sublabel: string;
  status: TripStepStatus;
}
