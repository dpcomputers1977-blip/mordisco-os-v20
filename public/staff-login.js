(() => {
  'use strict';

  const SUPABASE_URL = 'https://nmmjthqflxwucpmmmrks.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#staffLoginForm');
  const employeeSelect = $('#staffEmployee');
  const pinInput = $('#staffPin');
  const loginButton = $('#staffLogin');
  const message = $('#staffMessage');
  let employees = [];

  function showMessage(text, isError = true) {
    message.textContent = text;
    message.classList.toggle('successMessage', !isError);
  }

  async function supabaseRequest(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }

      if (!response.ok) {
        const detail = data?.message || data?.hint || data?.details || `Error ${response.status}`;
        throw new Error(detail);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadEmployees() {
    showMessage('Cargando empleados...', false);
    employeeSelect.disabled = true;

    try {
      employees = await supabaseRequest(
        'staff?select=id,name,role&active=eq.true&order=name.asc'
      );

      employeeSelect.innerHTML = '<option value="">Selecciona tu nombre</option>' +
        employees.map((employee) => {
          const roles = {
            admin: 'Administrador',
            waiter: 'Mesero',
            cashier: 'Cajero',
            kitchen: 'Cocina'
          };
          return `<option value="${employee.id}">${employee.name} — ${roles[employee.role] || employee.role}</option>`;
        }).join('');

      employeeSelect.disabled = false;
      showMessage(
        employees.length ? 'Selecciona tu nombre y escribe el PIN.' : 'No hay empleados activos registrados.',
        !employees.length
      );
    } catch (error) {
      console.error('Error cargando empleados:', error);
      employeeSelect.innerHTML = '<option value="">No se pudieron cargar los empleados</option>';
      showMessage(`No se pudieron cargar los empleados: ${error.message}`);
    }
  }

  async function verifyPin(employeeId, pin) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_staff_pin`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          staff_id: employeeId,
          staff_pin: pin
        })
      });

      const text = await response.text();
      let result = null;
      if (text) {
        try { result = JSON.parse(text); } catch { result = text; }
      }

      if (!response.ok) {
        const detail = result?.message || result?.hint || result?.details || `Error ${response.status}`;
        throw new Error(detail);
      }

      return result === true || result === 'true';
    } finally {
      clearTimeout(timeout);
    }
  }

  function redirectEmployee(employee) {
    localStorage.setItem('mordisco_employee', JSON.stringify(employee));

    const destinations = {
      waiter: '/comandas',
      kitchen: '/admin?employee=1&tab=kitchen',
      cashier: '/admin?employee=1&tab=pos',
      admin: '/admin?employee=1&tab=dashboard'
    };

    window.location.assign(destinations[employee.role] || '/staff');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const employeeId = employeeSelect.value;
    const pin = pinInput.value.trim();

    if (!employeeId) {
      showMessage('Selecciona un empleado.');
      employeeSelect.focus();
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      showMessage('El PIN debe contener entre 4 y 6 números.');
      pinInput.focus();
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Verificando...';
    showMessage('Validando acceso...', false);

    try {
      const valid = await verifyPin(employeeId, pin);
      if (!valid) {
        showMessage('PIN incorrecto.');
        pinInput.select();
        return;
      }

      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) {
        showMessage('No se encontró la información del empleado.');
        return;
      }

      showMessage(`Bienvenido, ${employee.name}.`, false);
      setTimeout(() => redirectEmployee(employee), 350);
    } catch (error) {
      console.error('Error validando PIN:', error);
      if (error.name === 'AbortError') {
        showMessage('La validación tardó demasiado. Revisa tu conexión e inténtalo nuevamente.');
      } else {
        showMessage(`No se pudo validar el ingreso: ${error.message}`);
      }
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Ingresar';
    }
  });

  loadEmployees();
})();
