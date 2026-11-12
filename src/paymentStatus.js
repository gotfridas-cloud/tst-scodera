function createPaymentStatusUpdateHandler({ updateStatus, notifyPaymentStatusChanged }) {
  if (typeof updateStatus !== 'function') {
    throw new TypeError('updateStatus must be a function');
  }
  if (typeof notifyPaymentStatusChanged !== 'function') {
    throw new TypeError('notifyPaymentStatusChanged must be a function');
  }

  return async function updatePaymentStatus(paymentId, status) {
    const updatedPayment = await updateStatus(paymentId, status);

    if (!updatedPayment || updatedPayment.previousStatus === updatedPayment.status) {
      return updatedPayment;
    }

    await notifyPaymentStatusChanged({
      paymentId: updatedPayment.paymentId ?? paymentId,
      previousStatus: updatedPayment.previousStatus,
      status: updatedPayment.status,
    });

    return updatedPayment;
  };
}

module.exports = { createPaymentStatusUpdateHandler };
