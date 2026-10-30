/* Gold Shine – datos base de la app.
   Para agregar plantillas nuevas por defecto, sumalas en BUILTIN_TEMPLATES
   (con un "id" nuevo). Aparecen solas en el teléfono al actualizar la app. */
window.GS = window.GS || {};

GS.VERSION = '1.1.0';

GS.DEFAULT_SETTINGS = {
  businessName: 'Gold Shine',
  ownerName: 'Santiago',
  tagline: 'Restauración & Personalización de Ópticas',
  instagram: '@gold_shinee',
  instagramUrl: 'https://www.instagram.com/gold_shinee',
  facebookLabel: 'facebook.com/share/1KHxH3a8Qc',
  facebookUrl: 'https://www.facebook.com/share/1KHxH3a8Qc/?mibextid=wwXIfr',
  whatsappDisplay: '+54 9 2944 62-7732',
  whatsappNumber: '5492944627732',
  closing:
    'Evaluamos el estado de tus ópticas y te recomendamos la mejor opción para que no gastes de más.\nConsultame y coordinamos turno sin compromiso.',
  prefix: 'GS-',
  nextNumber: 1
};

GS.BUILTIN_TEMPLATES = [
  {
    id: 'pulido',
    name: 'Pulido profesional de ópticas',
    description: 'Ideal para ópticas levemente opacas o con desgaste superficial.',
    benefits: ['Elimina rayas finas y devuelve claridad', 'Mejora estética'],
    duration: '6 a 10 meses',
    price: 80000,
    desde: true,
    unit: 'el par'
  },
  {
    id: 'polimero',
    name: 'Tratamiento con polímero líquido (premium)',
    description: 'Recomendado para ópticas muy opacas, quemadas por el sol o deterioradas.',
    benefits: ['Restauración más profunda y acabado tipo 0km', 'Protección UV real'],
    duration: 'hasta 3 años',
    price: 120000,
    desde: true,
    unit: 'el par'
  },
  {
    id: 'giros-simples',
    name: 'Instalación de kit de giros fijos simples',
    description: 'Instalación de kit de giros fijos.',
    benefits: ['Instalación prolija y segura'],
    duration: '',
    price: 60000,
    desde: true,
    unit: 'el par'
  },
  {
    id: 'giros-premium',
    name: 'Instalación de giros fijos premium (con relay)',
    description: 'Giros fijos premium con relay para un funcionamiento más estable.',
    benefits: ['Instalación con relay', 'Mayor durabilidad y estabilidad'],
    duration: '',
    price: 100000,
    desde: true,
    unit: 'el par'
  },
  {
    id: 'proyectores-lupa',
    name: 'Kit de proyectores lupa bi-LED láser de 3"',
    description: 'Personalización con proyectores lupa bi-LED láser de 3". El valor es del kit; la mano de obra se cotiza aparte.',
    benefits: ["Mejor luz y mayor alcance", "Aspecto moderno y deportivo", "Mano de obra aparte"],
    duration: '',
    price: 280000,
    desde: false,
    unit: 'el kit'
  },
  {
    id: 'blackhousing',
    name: 'Blackhousing',
    description: 'Personalización del interior de las ópticas en negro para un look más agresivo.',
    benefits: ['Interior negro con acabado profesional'],
    duration: '',
    price: 150000,
    desde: true,
    unit: 'el par'
  },
  {
    id: 'tiras-led',
    name: 'Tiras LED',
    description: 'Tiras LED para personalizar. Consultar modelos disponibles.',
    benefits: ['Distintos modelos a elección'],
    duration: '',
    price: 0,
    desde: false,
    unit: ''
  },
  {
    id: 'angel-blanco',
    name: 'Ojos de ángel LED blancos',
    description: 'Ojos de ángel LED color blanco.',
    benefits: ['Luz blanca nítida', 'Identidad visual premium'],
    duration: '',
    price: 200000,
    desde: false,
    unit: 'el par'
  },
  {
    id: 'angel-rgb',
    name: 'Ojos de ángel RGB',
    description: 'Ojos de ángel LED RGB con cambio de color.',
    benefits: ['Colores a elección', 'Máxima personalización'],
    duration: '',
    price: 280000,
    desde: false,
    unit: 'el par'
  }
];

GS.CONDITIONS = [
  'Levemente opacas',
  'Muy opacas',
  'Amarillentas',
  'Quemadas por el sol',
  'Con rayas',
  'Deterioradas'
];
