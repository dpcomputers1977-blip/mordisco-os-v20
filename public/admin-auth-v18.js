(() => {
  'use strict';

  const SUPABASE_URL = 'https://nmmjthqflxwucpmmmrks.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';
  const DEFAULT_ADMIN_EMAIL = 'dpcomputers1977+admin@gmail.com';

  const client = window.mordiscoSupabaseClient ||
    window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

  if (client) window.mordiscoSupabaseClient = client;

  function message(text, type = 'info') {
    let box = document.querySelector('#loginDirectMessage');
    if (!box) {
      box = document.createElement('div');
      box.id = 'loginDirectMessage';
      box.setAttribute('role', 'status');
      document.querySelector('#loginForm')?.appendChild(box);
    }
    const styles = {
      info: ['#fff1b8', '#6a5100'],
      error: ['#ffe0dc', '#8d1e16'],
      success: ['#dff7e7', '#11652d']
    };
    const [background, color] = styles[type] || styles.info;
    Object.assign(box.style, {
      marginTop: '12px',
      padding: '11px 13px',
      borderRadius: '10px',
      font: '700 13px system-ui,sans-serif',
      background,
      color
    });
    box.textContent = text;
  }

  async function verifyAdmin(userId) {
    const { data, error } = await client
      .from('admin_users')
      .select('user_id, active')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (error) throw new Error('No se pudo comprobar el permiso de administrador.');
    return Boolean(data);
  }

  async function openAdmin(session) {
    const allowed = await verifyAdmin(session.user.id);
    if (!allowed) {
      await client.auth.signOut();
      throw new Error('Este usuario no tiene permiso de administrador.');
    }
    sessionStorage.setItem('mordisco_admin_verified', '1');
    window.location.replace('/admin?session=ok');
  }

  async function passwordLogin(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error('Supabase no devolvió una sesión.');
    await openAdmin(data.session);
  }

  async function sendMagicLink(email) {
    const redirectTo = `${window.location.origin}/admin`;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
    });
    if (error) throw error;
  }

  async function sendRecovery(email) {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  function addRecoveryButtons(form) {
    if (document.querySelector('#adminRecoveryActions')) return;
    const actions = document.createElement('div');
    actions.id = 'adminRecoveryActions';
    actions.innerHTML = `
      <button type="button" id="magicLinkButton">Enviar enlace de acceso</button>
      <button type="button" id="resetPasswordButton">Restablecer contraseña</button>
    `;
    Object.assign(actions.style, {
      display:'grid',
      gridTemplateColumns:'1fr',
      gap:'8px',
      marginTop:'10px'
    });
    actions.querySelectorAll('button').forEach(button => Object.assign(button.style, {
      border:'1px solid #dfcda9',
      background:'#fff',
      color:'#4b3b1c',
      padding:'11px',
      borderRadius:'10px',
      fontWeight:'800',
      cursor:'pointer'
    }));
    form.appendChild(actions);

    actions.querySelector('#magicLinkButton').addEventListener('click', async () => {
      const email = document.querySelector('#loginEmail')?.value.trim();
      if (!email) return message('Escribe primero el correo del administrador.', 'error');
      try {
        message('Enviando enlace de acceso…');
        await sendMagicLink(email);
        message('Revisa tu correo. Te enviamos un enlace para entrar sin contraseña.', 'success');
      } catch (error) {
        message(error?.message || 'No se pudo enviar el enlace.', 'error');
      }
    });

    actions.querySelector('#resetPasswordButton').addEventListener('click', async () => {
      const email = document.querySelector('#loginEmail')?.value.trim();
      if (!email) return message('Escribe primero el correo del administrador.', 'error');
      try {
        message('Enviando recuperación…');
        await sendRecovery(email);
        message('Revisa tu correo. Te enviamos un enlace para crear una contraseña nueva.', 'success');
      } catch (error) {
        message(error?.message || 'No se pudo enviar la recuperación.', 'error');
      }
    });
  }

  async function start() {
    const form = document.querySelector('#loginForm');
    if (!form || !client) {
      message('No se pudo cargar la conexión con Supabase.', 'error');
      return;
    }

    const emailInput = document.querySelector('#loginEmail');
    if (emailInput && !emailInput.value) emailInput.value = DEFAULT_ADMIN_EMAIL;
    addRecoveryButtons(form);

    const { data } = await client.auth.getSession();
    if (data?.session) {
      try {
        await openAdmin(data.session);
        return;
      } catch (error) {
        message(error.message, 'error');
      }
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = emailInput?.value.trim() || '';
      const password = document.querySelector('#loginPassword')?.value || '';
      const button = form.querySelector('button[type="submit"], button.primary');

      if (!email || !password) return message('Escribe el correo y la contraseña.', 'error');

      if (button) {
        button.disabled = true;
        button.textContent = 'Ingresando…';
      }
      message('Verificando acceso…');

      try {
        await passwordLogin(email, password);
      } catch (error) {
        const raw = String(error?.message || 'Error desconocido');
        const friendly = /invalid login credentials/i.test(raw)
          ? 'La contraseña no coincide. Usa “Restablecer contraseña” o “Enviar enlace de acceso”.'
          : raw;
        message(friendly, 'error');
        if (button) {
          button.disabled = false;
          button.textContent = 'Ingresar';
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
