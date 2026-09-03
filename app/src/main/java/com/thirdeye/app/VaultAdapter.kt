package com.thirdeye.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.RecyclerView
import java.io.File

class VaultAdapter(
    private val context: Context,
    private var videoFiles: MutableList<File>,
    private val onDelete: (File) -> Unit
) : RecyclerView.Adapter<VaultAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvName: TextView = view.findViewById(R.id.tvVideoName)
        val tvDetails: TextView = view.findViewById(R.id.tvVideoDetails)
        val btnPlay: Button = view.findViewById(R.id.btnPlayVideo)
        val btnDelete: Button = view.findViewById(R.id.btnDeleteVideo)
        val btnShare: Button = view.findViewById(R.id.btnShareVideo)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_recording, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val file = videoFiles[position]
        holder.tvName.text = file.name
        val sizeMb = file.length().toDouble() / (1024 * 1024)
        holder.tvDetails.text = String.format("%.1f MB • Local Vault", sizeMb)

        holder.btnPlay.setOnClickListener {
            playVideo(file)
        }

        holder.btnDelete.setOnClickListener {
            onDelete(file)
        }

        holder.btnShare.setOnClickListener {
            shareVideo(file)
        }
    }

    private fun playVideo(file: File) {
        try {
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun shareVideo(file: File) {
        try {
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "video/mp4"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Third Eye Recording")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(shareIntent, "Save or Upload Video"))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun updateList(newList: List<File>) {
        videoFiles = newList.toMutableList()
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = videoFiles.size
}
