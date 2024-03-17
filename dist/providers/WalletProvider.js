"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionStatus = void 0;
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["PENDING"] = "pending";
    ExecutionStatus["SUCCESS"] = "success";
    ExecutionStatus["FAILED"] = "failed";
    ExecutionStatus["CANCELLED"] = "cancelled";
    ExecutionStatus["PROCESSING"] = "processing";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
