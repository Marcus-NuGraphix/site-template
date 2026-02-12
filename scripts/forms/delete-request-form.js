const ENDPOINT = '/delete-my-data/submit.php';
const MIN_SUBMIT_SECONDS = 3;

export function initDeleteRequestForm() {
  const form = document.querySelector('[data-delete-request-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.hasAttribute('data-form-disabled') || form.hidden) {
    return;
  }

  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const honeypot = form.querySelector('input[name="company"]');
  const submittedAtInput = form.querySelector('[data-submitted-at]');

  if (!(submitButton instanceof HTMLButtonElement)) {
    return;
  }

  let isSubmitting = false;

  const stampSubmitTime = () => {
    if (submittedAtInput instanceof HTMLInputElement) {
      submittedAtInput.value = String(Math.floor(Date.now() / 1000));
    }
  };

  const getElapsedSeconds = () => {
    if (!(submittedAtInput instanceof HTMLInputElement)) {
      return MIN_SUBMIT_SECONDS;
    }

    const submittedAt = Number.parseInt(submittedAtInput.value, 10);
    if (!Number.isFinite(submittedAt) || submittedAt <= 0) {
      return 0;
    }

    return Math.floor(Date.now() / 1000) - submittedAt;
  };

  const setStatus = (message, state = '') => {
    if (!(status instanceof HTMLElement)) {
      return;
    }

    status.textContent = message;
    status.className = state ? `form-status ${state}` : 'form-status';
  };

  const setSubmittingState = (busy) => {
    isSubmitting = busy;
    submitButton.disabled = busy;
    submitButton.setAttribute('aria-busy', busy ? 'true' : 'false');
    submitButton.textContent = busy ? 'Submitting...' : 'Submit Delete Request';
  };

  const validateClient = () => {
    if (honeypot instanceof HTMLInputElement && honeypot.value.trim() !== '') {
      setStatus('Unable to submit this request.', 'is-error');
      return false;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus('Please complete the required fields before submitting.', 'is-error');
      return false;
    }

    if (getElapsedSeconds() < MIN_SUBMIT_SECONDS) {
      setStatus('Please wait a few seconds before submitting the form.', 'is-error');
      return false;
    }

    return true;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!validateClient()) {
      return;
    }

    setSubmittingState(true);
    setStatus('Submitting your request...', 'is-info');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'omit',
        body: new FormData(form),
        headers: {
          Accept: 'application/json',
        },
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && typeof payload.error === 'string'
          ? payload.error
          : 'Unable to submit right now. Please try again later.';
        throw new Error(message);
      }

      form.reset();
      stampSubmitTime();
      setStatus('Request submitted successfully. We will respond by email after verification.', 'is-success');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to submit right now. Please try again later.';
      setStatus(message, 'is-error');
    } finally {
      setSubmittingState(false);
    }
  });

  stampSubmitTime();
}
