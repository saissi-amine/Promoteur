const PDFDocument = require('pdfkit');
const { supabaseAdmin, supabase } = require('../config/supabase');

/**
 * Génère un document PDF en mémoire à partir de PDFKit
 * @param {string} type - Le type de document ('receipt' ou 'reservation')
 * @param {object} data - Les données du document
 * @returns {Promise<Buffer>} Le tampon du fichier PDF
 */
function buildPDFBuffer(type, data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // En-tête de page commun
      doc.fillColor('#0F172A').fontSize(22).text('PLATEFORME IMMO', { align: 'center' });
      doc.fontSize(10).fillColor('#64748B').text('Gestion et Promotion Immobilière Digitale', { align: 'center' });
      doc.moveDown(2);

      if (type === 'receipt') {
        // --- REÇU DE PAIEMENT ---
        doc.fillColor('#0F172A').fontSize(16).text('REÇU DE REGLEMENT OFFICIEUX', { align: 'center', underline: true });
        doc.moveDown(1.5);
        
        doc.fontSize(11).fillColor('#334155');
        doc.text(`Référence Reçu : REC-${data.id.substring(0, 8).toUpperCase()}`);
        doc.text(`Date de paiement : ${new Date(data.paid_at || Date.now()).toLocaleDateString('fr-FR')}`);
        doc.moveDown(1);
        
        // Cadre info lot
        doc.rect(50, doc.y, 500, 100).strokeColor('#E2E8F0').stroke();
        const startY = doc.y + 10;
        doc.text(`Projet : ${data.lot.project.name}`, 65, startY);
        doc.text(`Lot : N° ${data.lot.number} (${data.lot.type})`, 65, startY + 20);
        doc.text(`Acquéreur : ${data.client.full_name || data.client.email}`, 65, startY + 40);
        doc.text(`Email : ${data.client.email} | Tél : ${data.client.phone || 'Non renseigné'}`, 65, startY + 60);
        
        doc.moveDown(3);
        doc.fontSize(14).fillColor('#10B981').text(`Montant versé : ${Number(data.amount).toLocaleString('fr-FR')} DH`, { bold: true });
        doc.fontSize(11).fillColor('#334155').text(`Statut de la facture : ACQUITTEE`, { bold: true });
        doc.text(`Date limite initiale : ${new Date(data.due_date).toLocaleDateString('fr-FR')}`);
        
        doc.moveDown(3);
        doc.fontSize(9).fillColor('#94A3B8').text('Ce document électronique est généré automatiquement par la Plateforme Immo et fait foi de paiement sous réserve d\'encaissement effectif des fonds.', { align: 'center', italic: true });
        
      } else {
        // --- CONTRAT DE RESERVATION ---
        doc.fillColor('#0F172A').fontSize(16).text('CONTRAT DE RÉSERVATION PRÉLIMINAIRE', { align: 'center', underline: true });
        doc.moveDown(1.5);
        
        doc.fontSize(11).fillColor('#334155');
        doc.text(`Contrat N° : RSV-${data.lot.id.substring(0, 8).toUpperCase()}`);
        doc.text(`Date de signature : ${new Date().toLocaleDateString('fr-FR')}`);
        doc.moveDown(1.5);
        
        doc.fontSize(12).fillColor('#0F172A').text('1. PARTIES CONTRACTANTES', { bold: true });
        doc.fontSize(11).fillColor('#334155');
        doc.text(`Le Promoteur : PLATEFORME IMMO - Siège Social Casablanca`);
        doc.text(`L'Acquéreur : ${data.client.full_name || data.client.email}`);
        doc.text(`Adresse e-mail : ${data.client.email}`);
        doc.text(`Téléphone : ${data.client.phone || 'Non renseigné'}`);
        doc.moveDown(1.5);

        doc.fontSize(12).fillColor('#0F172A').text('2. DESIGNATION DU BIEN IMMOBILIER', { bold: true });
        doc.fontSize(11).fillColor('#334155');
        doc.text(`Nom de la Résidence : ${data.lot.project.name}`);
        doc.text(`Numéro de Lot : N° ${data.lot.number}`);
        doc.text(`Type du lot : ${data.lot.type}`);
        doc.text(`Prix global de vente H.T. : ${Number(data.lot.price).toLocaleString('fr-FR')} DH`);
        doc.moveDown(1.5);

        doc.fontSize(12).fillColor('#0F172A').text('3. MODALITÉS DE PAIEMENT', { bold: true });
        doc.fontSize(11).fillColor('#334155');
        doc.text('Un dépôt de garantie de 10% du prix d\'acquisition est exigé au moment de la signature.');
        doc.text('Le reliquat sera fractionné en fonction des appels de fonds de chantier validés par le Maître d\'œuvre.');
        doc.moveDown(3);

        doc.text('Signature du Promoteur                     Signature de l\'Acquéreur', { align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Génère le reçu de paiement au format PDF et l'enregistre sur Supabase
 * @param {object} payment - L'objet paiement complet
 * @param {string} filename - Le nom de fichier cible
 * @returns {Promise<string>} L'URL de téléchargement du fichier PDF
 */
exports.generateReceiptPDF = async (payment, filename) => {
  const clientToUse = supabaseAdmin || supabase;
  
  try {
    const buffer = await buildPDFBuffer('receipt', payment);
    
    // Uploader sur Supabase Storage (vault-docs)
    const { data, error } = await clientToUse.storage
      .from('vault-docs')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.warn("Échec de l'upload du reçu sur Supabase. Utilisation de l'URL virtuelle. Raison :", error.message);
    }

    // Récupérer l'URL publique
    const { data: urlData } = clientToUse.storage
      .from('vault-docs')
      .getPublicUrl(filename);

    return urlData?.publicUrl || `https://supabase.co/storage/v1/object/public/vault-docs/${filename}`;
  } catch (err) {
    console.error('Erreur generateReceiptPDF:', err.message);
    throw err;
  }
};

/**
 * Génère le contrat de réservation au format PDF et l'enregistre sur Supabase
 * @param {object} lot - Le lot concerné
 * @param {object} client - Le client acquéreur
 * @param {string} filename - Le nom de fichier cible
 * @returns {Promise<string>} L'URL du contrat
 */
exports.generateReservationPDF = async (lot, client, filename) => {
  const clientToUse = supabaseAdmin || supabase;
  
  try {
    const buffer = await buildPDFBuffer('reservation', { lot, client });
    
    // Uploader sur Supabase Storage (vault-docs)
    const { data, error } = await clientToUse.storage
      .from('vault-docs')
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.warn("Échec de l'upload du contrat sur Supabase. Utilisation de l'URL virtuelle. Raison :", error.message);
    }

    // Récupérer l'URL publique
    const { data: urlData } = clientToUse.storage
      .from('vault-docs')
      .getPublicUrl(filename);

    return urlData?.publicUrl || `https://supabase.co/storage/v1/object/public/vault-docs/${filename}`;
  } catch (err) {
    console.error('Erreur generateReservationPDF:', err.message);
    throw err;
  }
};
