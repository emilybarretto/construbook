// Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAZrzDBx4ufPASHfd9mBF0A8LHXWVCogp8",
  authDomain: "projeto-senai-e9329.firebaseapp.com",
  databaseURL: "https://projeto-senai-e9329-default-rtdb.firebaseio.com",
  projectId: "projeto-senai-e9329",
  storageBucket: "projeto-senai-e9329.firebasestorage.app",
  messagingSenderId: "821429313070",
  appId: "1:821429313070:web:38f7545d527386826c09bf",
  measurementId: "G-RE1KWMK3T6"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Inicializa os serviços que vamos usar no sistema inteiro
const auth = firebase.auth();
const db = firebase.firestore();

console.log("🔥 Firebase conectado com sucesso!");