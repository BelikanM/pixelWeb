// sections/Connexion.js
import React, { useState } from "react";
import { Form, Button, Card, Alert } from "react-bootstrap";
import { api } from "./api";

const Connexion = ({ setToken, navigate }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    phoneNumber: "",
    airtelQRCode: null,
  });
  const [filePreview, setFilePreview] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, airtelQRCode: file });
      if (file.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (isRegister) {
        if (!formData.airtelQRCode) {
          setError("Veuillez téléverser un fichier QR Airtel");
          return;
        }
        const data = new FormData();
        data.append("email", formData.email);
        data.append("password", formData.password);
        data.append("phoneNumber", formData.phoneNumber);
        data.append("airtelQRCode", formData.airtelQRCode);
        await api.post("/register", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess("Inscription réussie ! Redirection...");
        setTimeout(() => setIsRegister(false), 2000);
      } else {
        const response = await api.post("/login", {
          email: formData.email,
          password: formData.password,
        });
        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        setSuccess("Connexion réussie ! Redirection...");
        setTimeout(() => navigate("dashboard"), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'opération");
    }
  };

  return React.createElement(
    "div",
    { className: "container mt-5" },
    React.createElement(
      Card,
      { className: "mx-auto shadow-lg", style: { maxWidth: "400px" } },
      React.createElement(Card.Body, null, [
        React.createElement(Card.Title, { className: "text-center mb-4" }, isRegister ? "Inscription" : "Connexion"),
        error &&
          React.createElement(Alert, { variant: "danger", className: "text-center" }, error),
        success &&
          React.createElement(Alert, { variant: "success", className: "text-center" }, success),
        React.createElement(
          Form,
          { onSubmit: handleSubmit },
          React.createElement(
            Form.Group,
            { className: "mb-3", controlId: "email" },
            React.createElement(Form.Label, null, "Email"),
            React.createElement(Form.Control, {
              type: "email",
              name: "email",
              value: formData.email,
              onChange: handleChange,
              placeholder: "votre@email.com",
              required: true,
            })
          ),
          React.createElement(
            Form.Group,
            { className: "mb-3", controlId: "password" },
            React.createElement(Form.Label, null, "Mot de passe"),
            React.createElement(Form.Control, {
              type: "password",
              name: "password",
              value: formData.password,
              onChange: handleChange,
              placeholder: "********",
              required: true,
            })
          ),
          isRegister &&
            React.createElement(
              Form.Group,
              { className: "mb-3", controlId: "phoneNumber" },
              React.createElement(Form.Label, null, "Numéro de téléphone"),
              React.createElement(Form.Control, {
                type: "text",
                name: "phoneNumber",
                value: formData.phoneNumber,
                onChange: handleChange,
                placeholder: "+1234567890",
                required: true,
              })
            ),
          isRegister &&
            React.createElement(
              Form.Group,
              { className: "mb-3", controlId: "airtelQRCode" },
              React.createElement(Form.Label, null, "Code QR Airtel (JPEG, PNG, PDF)"),
              React.createElement(Form.Control, {
                type: "file",
                name: "airtelQRCode",
                accept: "image/jpeg,image/png,application/pdf",
                onChange: handleFileChange,
                required: true,
              })
            ),
          React.createElement(
            Button,
            {
              variant: "primary",
              type: "submit",
              className: "w-100 mt-3",
            },
            isRegister ? "S'inscrire" : "Se connecter"
          ),
          React.createElement(
            Button,
            {
              variant: "link",
              className: "w-100 mt-2",
              onClick: () => setIsRegister(!isRegister),
            },
            isRegister ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"
          )
        ),
      ])
    ),
    isRegister &&
      formData.airtelQRCode &&
      React.createElement(
        Card,
        { className: "mx-auto mt-4 qr-card" },
        React.createElement(Card.Body, { className: "text-center" }, [
          React.createElement(Card.Title, { className: "mb-3" }, "Aperçu du QR Code"),
          filePreview
            ? React.createElement("img", {
                src: filePreview,
                alt: "QR Code",
                className: "qr-image",
              })
            : React.createElement(
                Button,
                {
                  variant: "outline-secondary",
                  href: URL.createObjectURL(formData.airtelQRCode),
                  download: formData.airtelQRCode.name,
                  className: "mt-2",
                },
                "Télécharger le PDF"
              ),
        ])
      )
  );
};

export default Connexion;
