(() => {
  'use strict';

  const SUPABASE_URL = 'https://nmmjthqflxwucpmmmrks.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';

  function showLoginMessage(message, error = false) {
    let box = document.querySelector('#loginDirectMessage');
    if (!box) {
      box = document.createElement('div');
      box.id = 'loginDirectMessage';
      box.style.marginTop = '10px';
      box.style.padding = '10px 12px';
      box.style.borderRadius = '10px';
      box.style.font = '700 13px system-ui,sans-serif';
      const form = document.querySelector('#loginForm');
      form?.appendChild(box);
    }
    box.textContent = message;
    box.style.background = error ? '#ffe0dc' : '#fff1b8';
    box.style.color = error ? '#8d1e16' : '#6a5100';
  }



  async function start() {
    const form = document.querySelector('#loginForm');
    if (!form) return;

    const client = window.mordiscoSupabaseClient || window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
    if (client) window.mordiscoSupabaseClient = client;
    if (!client) {
      showLoginMessage('No se pudo cargar la conexión con Supabase.', true);
      return;
    }

    // If a session already exists, let the main panel continue normally.
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData?.session) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = (document.querySelector('#loginEmail')?.value || '').trim();
      const password = document.querySelector('#loginPassword')?.value || '';
      const button = form.querySelector('button[type="submit"], button');

      if (!email || !password) {
        showLoginMessage('Escribe el correo y la contraseña.', true);
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Ingresando...';
      }
      showLoginMessage('Verificando acceso...');

      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        showLoginMessage('Acceso correcto. Abriendo el panel...');
        window.location.replace('/admin?session=ok&v=18.3');
      } catch (error) {
        console.error('LOGIN DIRECTO V18.3:', error);
        showLoginMessage(
          'No se pudo iniciar sesión: ' + (error?.message || 'Error desconocido'),
          true
        );
        if (button) {
          button.disabled = false;
          button.textContent = 'Ingresar';
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
