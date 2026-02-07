// ====== CONFIG (mismo proyecto) ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const form = document.getElementById("registerForm");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regPassword2 = document.getElementById("regPassword2");
const registerMsg = document.getElementById("registerMsg");
const btnRegister = document.getElementById("btnRegister");

function show(el) {
  el?.classList.remove("hidden");
}
function hide(el) {
  el?.classList.add("hidden");
}
function setMsg(text) {
  if (!registerMsg) return;
  if (!text) {
    hide(registerMsg);
    registerMsg.textContent = "";
    return;
  }
  registerMsg.textContent = text;
  show(registerMsg);
}

function disable(disabled) {
  if (!btnRegister) return;
  btnRegister.disabled = !!disabled;
  btnRegister.classList.toggle("opacity-60", !!disabled);
  btnRegister.classList.toggle("cursor-not-allowed", !!disabled);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = regEmail?.value.trim();
  const p1 = regPassword?.value || "";
  const p2 = regPassword2?.value || "";

  if (!email) return setMsg("Introduce un email válido.");
  if (p1.length < 6) return setMsg("La contraseña debe tener mínimo 6 caracteres.");
  if (p1 !== p2) return setMsg("Las contraseñas no coinciden.");

  disable(true);

  const { error } = await supabaseClient.auth.signUp({
    email,
    password: p1,
  });

  disable(false);

  if (error) return setMsg("Error al crear cuenta: " + error.message);

  // Si supabase pide confirmación por email, el usuario debe confirmar.
  setMsg(
    "Cuenta creada ✅. Revisa tu email para confirmar (si está activado). Luego vuelve al login."
  );

  // Limpieza
  if (regPassword) regPassword.value = "";
  if (regPassword2) regPassword2.value = "";
});
