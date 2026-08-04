(() => {
  'use strict';

  const SUPABASE_URL = 'https://nmmjthqflxwucpmmmrks.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';
  const DEFAULT_EMAIL = 'dpcomputers1977+admin@gmail.com';

  const client = window.mordiscoSupabaseClient ||
    window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

  if (client) window.mordiscoSupabaseClient = client;

  const $ = (selector) => document.querySelector(selector);

  function showMessage(text, type = 'info') {
    let box = $('#loginDirectMessage');
    if (!box) {
      box = document.createElement('div');
      box.id = 'loginDirectMessage';
      box.setAttribute('role', 'status');
      $('#loginForm')?.appendChild(box);
    }
    const palette = {
      info: ['#fff4c7', '#654d00'],
      success: ['#def7e7', '#11652d'],
      error: ['#ffe1dd', '#8b1f17']
    };
    const [background, color] = palette[type] || palette.info;
    Object.assign(box.style, {
      marginTop: '12px',
      padding: '12px 14px',
      borderRadius: '10px',
      background,
      color,
      font: '700 13px system-ui, sans-serif',
      lineHeight: '1.4'
    });
    box.textContent = text;
  }

  async function isAdmin(userId) {
    const { data, error } = await client
      .from('admin_users')
      .select('user_id,active')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (error) throw new Error('No se pudo comprobar el permiso de administrador.');
    return Boolean(data);
  }

  async function enterAdmin(session) {
    if (!session?.user?.id) throw new Error('No se pudo crear la sesión.');
    const allowed = await isAdmin(session.user.id);
    if (!allowed) {
      await client.auth.signOut();
      throw new Error('Este usuario no está autorizado como administrador.');
    }
    sessionStorage.setItem('mordisco_admin_verified', '1');
    window.location.replace('/admin?session=ok');
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await enterAdmin(data.session);
  }

  async function sendMagicLink(email) {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin`
      }
    });
    if (error) throw error;
  }

  async function sendReset(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  }

  function addRecoveryActions(form) {
    if ($('#adminRecoveryActions')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'adminRecoveryActions';
    wrapper.innerHTML = `
      <button type="button" id="magicLinkButton">Entrar con enlace por correo</button>
      <button type="button" id="resetPasswordButton">Restablecer contraseña</button>
    `;
    Object.assign(wrapper.style, {
      display: 'grid',
      gap: '8px',
      marginTop: '10px'
    });
    wrapper.querySelectorAll('button').forEach(button => Object.assign(button.style, {
      width: '100%',
      border: '1px solid #dec99f',
      background: '#fff',
      color: '#4a3917',
      borderRadius: '10px',
      padding: '11px 12px',
      fontWeight: '800',
      cursor: 'pointer'
    }));
    form.appendChild(wrapper);

    $('#magicLinkButton').addEventListener('click', async () => {
      const email = $('#loginEmail')?.value.trim();
      if (!email) return showMessage('Escribe primero el correo.', 'error');
      try {
        showMessage('Enviando enlace de acceso…');
        await sendMagicLink(email);
        showMessage('Revisa tu correo. Te enviamos un enlace para entrar sin contraseña.', 'success');
      } catch (error) {
        showMessage(error?.message || 'No se pudo enviar el enlace.', 'error');
      }
    });

    $('#resetPasswordButton').addEventListener('click', async () => {
      const email = $('#loginEmail')?.value.trim();
      if (!email) return showMessage('Escribe primero el correo.', 'error');
      try {
        showMessage('Enviando recuperación…');
        await sendReset(email);
        showMessage('Revisa tu correo. Te enviamos un enlace para crear una contraseña nueva.', 'success');
      } catch (error) {
        showMessage(error?.message || 'No se pudo enviar la recuperación.', 'error');
      }
    });
  }

  async function initialize() {
    const form = $('#loginForm');
    if (!form || !client) return;

    const emailInput = $('#loginEmail');
    if (emailInput && !emailInput.value) emailInput.value = DEFAULT_EMAIL;
    addRecoveryActions(form);

    const { data } = await client.auth.getSession();
    if (data?.session) {
      try {
        await enterAdmin(data.session);
        return;
      } catch (error) {
        showMessage(error.message, 'error');
      }
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = emailInput?.value.trim() || '';
      const password = $('#loginPassword')?.value || '';
      const button = form.querySelector('button[type="submit"]');

      if (!email || !password) return showMessage('Escribe el correo y la contraseña.', 'error');

      if (button) {
        button.disabled = true;
        button.textContent = 'Ingresando…';
      }
      showMessage('Verificando acceso…');

      try {
        await signIn(email, password);
      } catch (error) {
        const raw = String(error?.message || 'No se pudo iniciar sesión.');
        const friendly = /invalid login credentials/i.test(raw)
          ? 'La contraseña no coincide. Usa “Entrar con enlace por correo” o “Restablecer contraseña”.'
          : raw;
        showMessage(friendly, 'error');
        if (button) {
          button.disabled = false;
          button.textContent = 'Ingresar';
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
