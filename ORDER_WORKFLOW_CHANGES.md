# Order delivery workflow fix

Copy each file into the same path in your project, then **restart the API server**
(the new `rider_accepted_at` column is added to the database automatically on start; no manual migration).

## New flow
Order placed -> Accepted -> Preparing -> Ready for pickup -> Picked up -> Out for delivery -> Delivered

| Step | Who can do it | API |
|------|---------------|-----|
| Accept / Reject | the order's supplier | POST /v1/orders/:id/accept, /decline |
| Preparing | the order's supplier | POST /v1/orders/:id/prepare |
| Ready for pickup | the order's supplier | POST /v1/orders/:id/ready |
| Assign rider | the order's supplier (until pickup) | POST /v1/orders/:id/assign-rider |
| Rider accepts | the assigned rider only | POST /v1/rider/orders/:id/accept |
| Picked up | the assigned rider only (must have accepted) | POST /v1/rider/orders/:id/pickup |
| Out for delivery | the assigned rider only | POST /v1/rider/orders/:id/start |
| Delivered | the assigned rider only, with the customer's 4-digit code (or proof photo) | POST /v1/rider/orders/:id/deliver |

## Removed / blocked for suppliers
- `POST /v1/deliveries` and `POST /v1/orders/:id/start` now answer 403 `SUPPLIER_CANNOT_DELIVER`.
- "start" is no longer a bulk action. "deliver" and "start" are rider-only in the state machine.
- The supplier app no longer has Start Delivery / Mark as Delivered.

## Backend protections (not just hidden buttons)
- State machine (`packages/contracts/order-machine/transitions.js`) lists exactly who may do each step.
- `order.service.js` also checks the signed-in user is the rider assigned to the order for pickup/start/deliver.
- Each status change is a guarded database UPDATE (`WHERE status = ? AND version = ?`), so two requests
  racing for the same step cannot both succeed (no duplicate delivery, no double ledger entries).
- Memory cache, realtime events and notifications are updated only after the database accepts the change.
- Delivery notifications to the customer: accepted, preparing, ready, picked up, out for delivery, delivered.

Tests: `npm test` -> 32 passing (3 new workflow tests; the old "supplier completes delivery" test was replaced).
