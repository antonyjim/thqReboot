import React, { Component } from 'react'
import Pills from './../common/PillLayout.jsx'
import { Field } from '../common/forms.jsx'
import API from '../lib/API.js'
import Table from '../common/Table.jsx'

class TableGeneralInformation extends Component {
  constructor(props) {
    super(props)
    this.state = {
      fields: {
        name: null
      },
      sys_id: props.sys_id,
      loaded: false
    }
    if (props.sys_id === 'new') {
      this.state.loaded = true
    } else {
      this.fetchTableInformation()
    }
  }

  fetchTableInformation() {
    API.get({ path: '/api/q/sys_db_object/' + this.state.sys_id })
      .then((response) => {
        this.setState({
          fields: response.data.sys_db_object || {},
          loaded: true
        })
      })
      .catch((e) => {
        throw e
      })
  }

  handleChange(e) {
    let state = { ...this.state }
    state.fields[e.target.id] = e.target.value
    this.setState(state)
  }

  submitChange(e) {
    e.preventDefault()
    let apiRoute = '/api/q/sys_db_object'
    let apiQuery
    if (this.state.sys_id === 'new') {
      apiQuery = API.post({ path: apiRoute, body: { ...this.state.fields } })
    } else {
      apiQuery = API.patch({
        path: apiRoute + '/' + this.state.sys_id,
        body: { ...this.state.fields }
      })
    }
    apiQuery
      .then((response) => {
        console.log(response)
      })
      .catch((err) => {
        console.error(err)
      })
  }

  render() {
    return (
      <>
        {this.state.loaded && (
          <>
            <h4> General Information </h4>
            <hr />
            <form className='form-row' name='info'>
              <Field
                label='Label'
                value={this.state.fields.label}
                id='label'
                onChange={this.handleChange.bind(this)}
                className='col-lg-6 col-md-12'
              />
              <Field
                label='Name'
                value={this.state.fields.name}
                id='name'
                onChange={this.handleChange.bind(this)}
                readOnly='readonly'
                className='col-lg-6 col-md-12'
              />
              <Field
                label='Description'
                value={this.state.fields.description}
                id='description'
                onChange={this.handleChange.bind(this)}
                className='col-lg-12'
              />
              <button
                className='btn btn-primary btn-block'
                onClick={this.submitChange.bind(this)}
              >
                Save
              </button>
            </form>
          </>
        )}
      </>
    )
  }
}

export class TableModifier extends Component {
  constructor(props) {
    super(props)
    this.state = {
      sys_id: props.id
    }
  }

  render() {
    const pills = {
      generalInformation: {
        id: 'general',
        label: 'General Info',
        body: <TableGeneralInformation sys_id={this.state.sys_id} />
      },
      relatedFields: {
        id: 'related',
        label: 'Fields',
        body: (
          <Table
            table='sys_db_dictionary_list'
            args={{ table_name: this.state.sys_id }}
            showSearch={true}
          />
        )
      }
    }
    return <Pills pills={pills} />
  }
}
