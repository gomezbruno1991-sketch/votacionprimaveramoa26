import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import "./styles.css";
import { supabase } from "./supabase";

type Categoria = "REY" | "REINA";

type Candidato = {
  id: number;
  nombre: string;
  categoria: Categoria;
  activo: boolean;
};

type Voto = {
  rey_id: number;
  reina_id: number;
};

type Resultado = {
  id: number;
  nombre: string;
  votos: number;
};

export default function App() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");

  const [reySeleccionado, setReySeleccionado] = useState("");
  const [reinaSeleccionada, setReinaSeleccionada] = useState("");

  const [abierta, setAbierta] = useState<boolean | null>(null);

  const [resultadosRey, setResultadosRey] = useState<Resultado[]>([]);
  const [resultadosReina, setResultadosReina] = useState<Resultado[]>([]);

  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const candidatosRey = useMemo(
    () =>
      candidatos.filter(
        (candidato) => candidato.categoria === "REY"
      ),
    [candidatos]
  );

  const candidatosReina = useMemo(
    () =>
      candidatos.filter(
        (candidato) => candidato.categoria === "REINA"
      ),
    [candidatos]
  );

  const cargarCandidatos = useCallback(async () => {
    const { data, error } = await supabase
      .from("votacion_candidatos")
      .select("id, nombre, categoria, activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.error(error);
      alert("No se pudieron cargar los candidatos.");
      return;
    }

    setCandidatos((data || []) as Candidato[]);
  }, []);

  const iniciarAplicacion = useCallback(async () => {
    setCargando(true);

    const { data: config, error: errorConfig } = await supabase
      .from("votacion_config")
      .select("abierta")
      .eq("id", 1)
      .single();

    if (errorConfig) {
      console.error(errorConfig);
      alert("No se pudo consultar el estado de la votación.");
      setCargando(false);
      return;
    }

    const estado = Boolean(config?.abierta);

    setAbierta(estado);

    await cargarCandidatos();

    setCargando(false);
  }, [cargarCandidatos]);

  useEffect(() => {
    iniciarAplicacion();
  }, [iniciarAplicacion]);

  const generarHash = async (texto: string) => {
    const encoder = new TextEncoder();

    const datos = encoder.encode(
      texto.trim().toLowerCase()
    );

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      datos
    );

    const hashArray = Array.from(
      new Uint8Array(hashBuffer)
    );

    return hashArray
      .map((byte) =>
        byte.toString(16).padStart(2, "0")
      )
      .join("");
  };

  const emitirVoto = async () => {
    if (!nombre.trim()) {
      alert("Ingresá tu nombre y apellido.");
      return;
    }

    const emailNormalizado =
      email.trim().toLowerCase();

    if (!emailNormalizado) {
      alert("Ingresá tu email.");
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        emailNormalizado
      )
    ) {
      alert("Ingresá un email válido.");
      return;
    }

    if (!reySeleccionado) {
      alert("Elegí al Rey de la Primavera.");
      return;
    }

    if (!reinaSeleccionada) {
      alert("Elegí a la Reina de la Primavera.");
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmás tu voto?\n\nUna vez enviado no vas a poder modificarlo."
    );

    if (!confirmar) {
      return;
    }

    try {
      setEnviando(true);

      const hashEmail =
        await generarHash(emailNormalizado);

      const hashNombre =
        await generarHash(nombre);

      const { error } = await supabase
        .from("votacion_votos")
        .insert({
          votante_nombre: hashNombre,
          votante_email: hashEmail,
          rey_id: Number(reySeleccionado),
          reina_id: Number(reinaSeleccionada)
        });

      if (error) {
        console.error(error);

        if (
          error.code === "23505" ||
          error.message?.toLowerCase().includes("unique")
        ) {
          alert(
            "Este email ya emitió su voto. Solo se permite una participación por persona."
          );
          return;
        }

        alert(
          "No se pudo registrar el voto. Intentá nuevamente."
        );
        return;
      }

      setEnviado(true);
    } catch (error) {
      console.error(error);

      alert(
        "Ocurrió un error inesperado al registrar el voto."
      );
    } finally {
      setEnviando(false);
    }
  };

  const cargarResultados = useCallback(async () => {
    const { data: votos, error } = await supabase
      .from("votacion_votos")
      .select("rey_id, reina_id");

    if (error) {
      console.error(error);

      alert(
        "No se pudieron cargar los resultados."
      );

      return;
    }

    const votosProcesados =
      (votos || []) as Voto[];

    const resultadoReyes =
      candidatosRey.map((candidato) => ({
        id: candidato.id,
        nombre: candidato.nombre,
        votos: votosProcesados.filter(
          (voto) =>
            Number(voto.rey_id) === candidato.id
        ).length
      }));

    const resultadoReinas =
      candidatosReina.map((candidato) => ({
        id: candidato.id,
        nombre: candidato.nombre,
        votos: votosProcesados.filter(
          (voto) =>
            Number(voto.reina_id) === candidato.id
        ).length
      }));

    resultadoReyes.sort(
      (a, b) => b.votos - a.votos
    );

    resultadoReinas.sort(
      (a, b) => b.votos - a.votos
    );

    setResultadosRey(resultadoReyes);
    setResultadosReina(resultadoReinas);
  }, [candidatosRey, candidatosReina]);

  useEffect(() => {
    if (
      abierta === false &&
      candidatos.length > 0
    ) {
      cargarResultados();
    }
  }, [
    abierta,
    candidatos.length,
    cargarResultados
  ]);

  if (cargando) {
    return (
      <div className="pagina">
        <div className="contenedor pantallaCargando">
          <img
            src="/molinos-agro-logo.png"
            className="logo"
            alt="Molinos Agro"
          />

          <div className="spinner" />

          <h2>Preparando la votación...</h2>
        </div>
      </div>
    );
  }

  if (abierta === false) {
    return (
      <PantallaResultados
        reyes={resultadosRey}
        reinas={resultadosReina}
      />
    );
  }

  if (enviado) {
    return (
      <div className="pagina">
        <div className="contenedor confirmacion">
          <img
            src="/molinos-agro-logo.png"
            className="logo"
            alt="Molinos Agro"
          />

          <div className="iconoConfirmacion">
            ✓
          </div>

          <div className="etiqueta">
            🌼 Votación Primavera
          </div>

          <h1>¡Voto registrado!</h1>

          <p className="textoGrande">
            Gracias por participar,{" "}
            <strong>
              {nombre.split(" ")[0]}
            </strong>.
          </p>

          <p className="textoSuave">
            Tu voto quedó registrado correctamente.
            Los resultados se conocerán cuando cierre
            la votación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina">
      <div className="decoracion flor1">
        ✿
      </div>

      <div className="decoracion flor2">
        ❀
      </div>

      <div className="decoracion flor3">
        ✦
      </div>

      <main className="contenedor">

        <header className="cabecera">
          <img
            src="/molinos-agro-logo.png"
            className="logo"
            alt="Molinos Agro"
          />

          <div className="etiqueta">
            🌼 Votación Primavera
          </div>

          <h1>
            Rey & Reina de la Primavera
          </h1>

          <p className="subtitulo">
            Elegí una persona para cada categoría.
            Tu voto es único y no podrá modificarse
            después de enviarlo.
          </p>
        </header>

        <section className="identificacion">

          <h2>
            👋 Primero, identificate
          </h2>

          <div className="campo">

            <label>
              Nombre y apellido
            </label>

            <input
              type="text"
              value={nombre}
              placeholder="Ej.: Juan el toro D antonio"
              onChange={(e) =>
                setNombre(e.target.value)
              }
              disabled={enviando}
            />

          </div>

          <div className="campo">

            <label>
              Email
            </label>

            <input
              type="email"
              value={email}
              placeholder="tu.email@empresa.com"
              onChange={(e) =>
                setEmail(e.target.value)
              }
              disabled={enviando}
            />

          </div>

        </section>

        <section className="categorias">

          <div className="tarjetaCategoria rey">

            <div className="corona">
              👑
            </div>

            <h2>
              Rey de la Primavera
            </h2>

            <p>
              Elegí un candidato
            </p>

            <select
              value={reySeleccionado}
              onChange={(e) =>
                setReySeleccionado(
                  e.target.value
                )
              }
              disabled={enviando}
            >

              <option value="">
                Seleccionar...
              </option>

              {candidatosRey.map(
                (candidato) => (
                  <option
                    key={candidato.id}
                    value={candidato.id}
                  >
                    {candidato.nombre}
                  </option>
                )
              )}

            </select>

          </div>

          <div className="tarjetaCategoria reina">

            <div className="corona">
              👑
            </div>

            <h2>
              Reina de la Primavera
            </h2>

            <p>
              Elegí una candidata
            </p>

            <select
              value={reinaSeleccionada}
              onChange={(e) =>
                setReinaSeleccionada(
                  e.target.value
                )
              }
              disabled={enviando}
            >

              <option value="">
                Seleccionar...
              </option>

              {candidatosReina.map(
                (candidato) => (
                  <option
                    key={candidato.id}
                    value={candidato.id}
                  >
                    {candidato.nombre}
                  </option>
                )
              )}

            </select>

          </div>

        </section>

        <div className="aviso">
          🔒 Cada email puede votar una sola vez.
        </div>

        <button
          className="botonVotar"
          onClick={emitirVoto}
          disabled={enviando}
        >
          {enviando
            ? "Registrando voto..."
            : "👑 Emitir mi voto"}
        </button>

      </main>
    </div>
  );
}

function PantallaResultados({
  reyes,
  reinas
}: {
  reyes: Resultado[];
  reinas: Resultado[];
}) {
  return (
    <div className="pagina">

      <main className="contenedor resultadosContenedor">

        <img
          src="/molinos-agro-logo.png"
          className="logo"
          alt="Molinos Agro"
        />

        <div className="etiqueta">
          🌼 Resultados finales
        </div>

        <h1>
          Rey & Reina de la Primavera
        </h1>

        <p className="subtitulo">
          ¡La votación ha finalizado!
        </p>

        <div className="ganadores">

          {reyes[0] && (
            <div className="ganador">

              <div className="coronaGrande">
                👑
              </div>

              <span>
                Rey de la Primavera
              </span>

              <strong>
                {reyes[0].nombre}
              </strong>

              <small>
                {reyes[0].votos} votos
              </small>

            </div>
          )}

          {reinas[0] && (
            <div className="ganador">

              <div className="coronaGrande">
                👑
              </div>

              <span>
                Reina de la Primavera
              </span>

              <strong>
                {reinas[0].nombre}
              </strong>

              <small>
                {reinas[0].votos} votos
              </small>

            </div>
          )}

        </div>

        <Grafico
          titulo="👑 Rey de la Primavera"
          resultados={reyes}
        />

        <Grafico
          titulo="👑 Reina de la Primavera"
          resultados={reinas}
        />

      </main>

    </div>
  );
}

function Grafico({
  titulo,
  resultados
}: {
  titulo: string;
  resultados: Resultado[];
}) {
  const maximo = Math.max(
    ...resultados.map(
      (resultado) => resultado.votos
    ),
    1
  );

  return (
    <section className="grafico">

      <h2>
        {titulo}
      </h2>

      {resultados.map(
        (resultado, index) => {

          const porcentaje =
            (resultado.votos / maximo) * 100;

          return (
            <div
              className={`filaGrafico ${
                index === 0
                  ? "primero"
                  : ""
              }`}
              key={resultado.id}
            >

              <div className="nombreGrafico">

                <span>
                  {resultado.nombre}
                </span>

                <strong>
                  {resultado.votos}
                </strong>

              </div>

              <div className="barraGrafico">

                <div
                  className="barraGraficoInterior"
                  style={{
                    width: `${porcentaje}%`
                  }}
                />

              </div>

            </div>
          );
        }
      )}

    </section>
  );
}